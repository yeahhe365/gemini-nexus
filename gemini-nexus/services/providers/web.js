
// services/providers/web.js
import { fetchRequestParams } from '../auth.js';
import { uploadFile } from '../upload.js';
import { parseGeminiLine } from '../parser.js';

// Configuration for supported models (Web Client specific)
const MODEL_HEADERS = {
    'gemini-3-flash':          '[1,null,null,null,"9ec249fc9ad08861",null,null,0,[4]]', // Fast
    'gemini-3-flash-thinking': '[1,null,null,null,"4af6c7f5da75d65d",null,null,0,[4]]', // Thinking
    'gemini-3-pro':            '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4]]'  // Pro
};

const DEFAULT_MODEL = 'gemini-3-flash';

async function handleFileUploads(files, signal) {
    if (!files || files.length === 0) return [];
    
    console.debug(`[Gemini Web] Uploading ${files.length} files...`);
    // Upload in parallel
    const fileList = await Promise.all(
        files.map(file => uploadFile(file, signal).then(url => [[url], file.name]))
    );
    console.debug("[Gemini Web] Files uploaded successfully");
    return fileList;
}

function constructPayload(prompt, fileList, contextIds) {
    // Structure aligned with Python Gemini-API: [prompt, 0, null, fileList] or [prompt]
    const messageStruct = fileList.length > 0 
        ? [prompt, 0, null, fileList] 
        : [prompt];

    const data = [
        messageStruct,
        null,
        contextIds // [conversationId, responseId, choiceId]
    ];

    // The API expects: f.req = JSON.stringify([null, JSON.stringify(data)])
    return JSON.stringify([null, JSON.stringify(data)]);
}

async function fetchStream(endpoint, atValue, fReq, headers, signal) {
    // Merge standard mimicry headers
    const finalHeaders = {
        ...headers,
        'Origin': 'https://gemini.google.com',
        'Referer': 'https://gemini.google.com/',
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        signal: signal,
        headers: finalHeaders,
        body: new URLSearchParams({
            at: atValue,
            'f.req': fReq
        })
    });

    if (!response.ok) {
        throw new Error(`Network Error: ${response.status} ${response.statusText}`);
    }
    return response.body.getReader();
}

/**
 * Sends a message using the Reverse Engineered Web Client.
 */
export async function sendWebMessage(prompt, context, model, files, signal, onUpdate) {
    console.debug(`[Gemini Web] Requesting model: ${model}`);

    // 1. Ensure Auth (Context)
    if (!context || !context.atValue) {
        // Fallback: This should ideally be handled by SessionManager before calling, 
        // but acts as a safety net.
        console.warn("[Gemini Web] No context provided, fetching default...");
        const params = await fetchRequestParams('0');
        context = {
            atValue: params.atValue,
            blValue: params.blValue,
            authUser: params.authUserIndex || '0', 
            contextIds: ['', '', ''] 
        };
    }

    // 2. Prepare Uploads
    const fileList = await handleFileUploads(files, signal);

    // 3. Construct Payload
    const fReq = constructPayload(prompt, fileList, context.contextIds);
    
    const queryParams = new URLSearchParams({
        bl: context.blValue || 'boq_assistant-bard-web-server_20230713.13_p0',
        _reqid: Math.floor(Math.random() * 900000) + 100000,
        rt: 'c'
    });

    const modelHeader = MODEL_HEADERS[model] || MODEL_HEADERS[DEFAULT_MODEL];
    
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Same-Domain': '1',
        'X-Goog-AuthUser': context.authUser,
        'x-goog-ext-525001261-jspb': modelHeader
    };

    const endpoint = `https://gemini.google.com/u/${context.authUser}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${queryParams.toString()}`;

    // 4. Execute Request
    console.debug(`[Gemini Web] Sending request to ${endpoint}`);
    const reader = await fetchStream(endpoint, context.atValue, fReq, headers, signal);

    // 5. Handle Stream Parsing
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalResult = null;
    let isFirstChunk = true;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            if (isFirstChunk) {
                if (chunk.includes('<!DOCTYPE html>') || chunk.includes('<html') || chunk.includes('Sign in')) {
                    throw new Error("未登录 (Session expired)");
                }
                isFirstChunk = false;
            }

            buffer += chunk;

            // Process line-by-line
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
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        if (e.message.includes("未登录")) throw e;
        console.error("Stream reading error:", e);
    }

    // Process remaining buffer
    if (buffer.length > 0) {
        const parsed = parseGeminiLine(buffer);
        if (parsed) finalResult = parsed;
    }

    if (!finalResult) {
        if (buffer.includes('<!DOCTYPE html>')) {
             throw new Error("未登录 (Session expired)");
        }
        console.debug("Invalid response buffer sample:", buffer.substring(0, 200));
        throw new Error("No valid response found. Check network.");
    }

    // 6. Return Result with Updated Context
    context.contextIds = finalResult.ids;
    
    console.debug("[Gemini Web] Request completed successfully");

    return {
        text: finalResult.text,
        thoughts: finalResult.thoughts,
        images: finalResult.images || [],
        newContext: context
    };
}