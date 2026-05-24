import { fetchRequestParams } from '../auth.js';
import { uploadFile } from '../upload.js';
import { parseGeminiLine } from '../parser.js';
import { generateUUID } from '../../shared/utils/index.js';
import {
    getSupportedWebModelValues,
    getWebModelHeaderConfig,
} from '../../shared/models/web_models.js';
import {
    DEFAULT_WEB_THINKING_LEVEL,
    normalizeWebThinkingLevelForModel,
} from '../../shared/models/web_thinking.js';
import { debugLog } from '../../shared/logging/debug.js';

const WEB_THINKING_INSTRUCTIONS = {
    minimal:
        'Gemini Nexus thinking mode: Minimal. Prioritize the fastest direct answer; keep internal reasoning to the minimum needed and do not mention this mode.',
    low: 'Gemini Nexus thinking mode: Low. Use concise reasoning, favor speed, and do not mention this mode.',
    medium: 'Gemini Nexus thinking mode: Medium. Balance reasoning depth with response speed and do not mention this mode.',
};

async function handleFileUploads(files, signal, uploadContext) {
    if (!files || files.length === 0) return [];

    debugLog(`[Gemini Web] Uploading ${files.length} files...`);
    // Upload in parallel
    const fileList = await Promise.all(
        files.map((file) =>
            uploadFile(file, signal, uploadContext).then((url) => [[url], file.name])
        )
    );
    debugLog('[Gemini Web] Files uploaded successfully');
    return fileList;
}

function constructPayload(prompt, fileList, contextIds) {
    // Structure aligned with Python Gemini-API: [prompt, 0, null, fileList] or [prompt]
    const messageStruct = fileList.length > 0 ? [prompt, 0, null, fileList] : [prompt];

    const requestPayload = [
        messageStruct,
        null,
        contextIds, // [conversationId, responseId, choiceId]
    ];

    // The API expects: f.req = JSON.stringify([null, JSON.stringify(requestPayload)])
    return JSON.stringify([null, JSON.stringify(requestPayload)]);
}

export function applyWebThinkingInstruction(prompt, model, thinkingLevel) {
    const normalizedLevel = normalizeWebThinkingLevelForModel(model, thinkingLevel);
    if (normalizedLevel === DEFAULT_WEB_THINKING_LEVEL) return String(prompt || '');

    const instruction = WEB_THINKING_INSTRUCTIONS[normalizedLevel];
    if (!instruction) return String(prompt || '');

    return [instruction, '', String(prompt || '')].join('\n');
}

function stripNativeContextIds(context = {}) {
    const { contextIds, ...authContext } = context;
    return authContext;
}

function buildModelHeader(model, requestId) {
    const config = getWebModelHeaderConfig(model);
    if (!config) {
        throw new Error(
            `Unsupported Gemini Web model: ${model}. Supported models: ${getSupportedWebModelValues().join(', ')}`
        );
    }

    return JSON.stringify([
        1,
        null,
        null,
        null,
        config.hash,
        null,
        null,
        0,
        [4],
        null,
        null,
        config.mode,
        null,
        null,
        config.featureMode,
        null,
        requestId,
    ]);
}

function buildEndpoint(authUser, queryParams) {
    const accountPrefix = authUser && authUser !== '0' ? `/u/${authUser}` : '';
    return `https://gemini.google.com${accountPrefix}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${queryParams.toString()}`;
}

function assertAuthToken(context, fieldName) {
    if (!context?.[fieldName]) {
        throw new Error(`Missing Gemini Web auth token: ${fieldName}`);
    }
}

function assertRequiredAuthTokens(context) {
    assertAuthToken(context, 'atValue');
    assertAuthToken(context, 'blValue');
    assertAuthToken(context, 'fSid');
}

async function fetchStream(endpoint, atValue, fReq, headers, signal) {
    // Merge standard mimicry headers
    const finalHeaders = {
        ...headers,
        Origin: 'https://gemini.google.com',
        Referer: 'https://gemini.google.com/',
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        signal: signal,
        headers: finalHeaders,
        body: new URLSearchParams({
            at: atValue,
            'f.req': fReq,
        }),
    });

    if (!response.ok) {
        throw new Error(`Network Error: ${response.status} ${response.statusText}`);
    }
    return response.body.getReader();
}

/**
 * Sends a message using the Reverse Engineered Web Client.
 */
export async function sendWebMessage(
    prompt,
    context,
    model,
    files,
    signal,
    onUpdate,
    options = {}
) {
    debugLog(`[Gemini Web] Requesting model: ${model}`);
    const requestId = generateUUID();
    const modelHeader = buildModelHeader(model, requestId);

    if (!context || !context.atValue) {
        // Fallback: This should ideally be handled by SessionManager before calling,
        // but acts as a safety net.
        console.warn('[Gemini Web] No context provided, fetching default...');
        const params = await fetchRequestParams('0');
        context = {
            atValue: params.atValue,
            blValue: params.blValue,
            fSid: params.fSid,
            locale: params.locale,
            authUser: params.authUserIndex || '0',
            uploadPushId: params.uploadPushId,
            uploadClientPctx: params.uploadClientPctx,
        };
    }

    assertRequiredAuthTokens(context);

    const fileList = await handleFileUploads(files, signal, context);

    // Current Gemini Web rejects the legacy three-id continuation payload without
    // the extra UI-only context token, so Web continuity is handled by the caller.
    const effectivePrompt = applyWebThinkingInstruction(prompt, model, options.thinkingLevel);
    const fReq = constructPayload(effectivePrompt, fileList, ['', '', '']);

    const queryParams = new URLSearchParams({
        bl: context.blValue,
        'f.sid': context.fSid,
        hl: context.locale || 'en-US',
        _reqid: String(Math.floor(Math.random() * 900000) + 100000),
        rt: 'c',
    });

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Same-Domain': '1',
        'x-goog-ext-525001261-jspb': modelHeader,
        'x-goog-ext-525005358-jspb': JSON.stringify([requestId, 1]),
        'x-goog-ext-73010989-jspb': '[0]',
        'x-goog-ext-73010990-jspb': '[0,0,0]',
    };
    if (context.authUser && context.authUser !== '0') {
        headers['X-Goog-AuthUser'] = context.authUser;
    }

    const endpoint = buildEndpoint(context.authUser, queryParams);

    debugLog(`[Gemini Web] Sending request to ${endpoint}`);
    const reader = await fetchStream(endpoint, context.atValue, fReq, headers, signal);

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalResult = null;
    let isFirstChunk = true;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            if (isFirstChunk) {
                if (
                    chunk.includes('<!DOCTYPE html>') ||
                    chunk.includes('<html') ||
                    chunk.includes('Sign in')
                ) {
                    throw new Error('未登录 (Session expired)');
                }
                isFirstChunk = false;
            }

            buffer += chunk;

            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                const parsed = parseGeminiLine(line);
                if (parsed) {
                    finalResult = parsed;
                    if (onUpdate) {
                        onUpdate(parsed.text, parsed.thoughts);
                    }
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (error.message.includes('未登录')) throw error;
        console.error('Stream reading error:', error);
    }

    if (buffer.length > 0) {
        const parsed = parseGeminiLine(buffer);
        if (parsed) finalResult = parsed;
    }

    if (!finalResult) {
        if (buffer.includes('<!DOCTYPE html>')) {
            throw new Error('未登录 (Session expired)');
        }
        debugLog('Invalid response buffer sample:', buffer.substring(0, 200));
        throw new Error('No valid response found. Check network.');
    }

    debugLog('[Gemini Web] Request completed successfully');

    return {
        text: finalResult.text,
        thoughts: finalResult.thoughts,
        images: finalResult.images || [],
        hasGeneratedImagePlaceholder: finalResult.hasGeneratedImagePlaceholder === true,
        newContext: stripNativeContextIds(context),
    };
}
