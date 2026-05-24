import { sendOfficialMessage } from '../../../services/providers/official.js';
import { sendWebMessage } from '../../../services/providers/web.js';
import { sendOpenAIMessage } from '../../../services/providers/openai_compatible.js';
import {
    DEFAULT_CONTEXT_MODE,
    DEFAULT_CONTEXT_RECENT_TURNS,
} from '../../../shared/config/constants.js';
import { normalizeWebThinkingLevelForModel } from '../../../shared/models/web_thinking.js';
import {
    describeMessageAttachmentMarkers,
    getAttachmentDataUrls,
    getImageAttachmentDataUrls,
    normalizeMessageImages,
} from '../../../shared/attachments/index.js';
import { getHistory } from './history_store.js';
import { prepareManagedContext } from './context_manager.js';

function getRequestHistory(request) {
    if (Array.isArray(request.historyOverride)) {
        return request.historyOverride;
    }
    return null;
}

function getFileImages(files) {
    if (!Array.isArray(files)) return [];
    return getAttachmentDataUrls(files);
}

function getMessageAttachmentDataUrls(message) {
    if (Array.isArray(message?.attachments) && message.attachments.length > 0) {
        return getAttachmentDataUrls(message.attachments);
    }
    return normalizeMessageImages(message?.image);
}

function hasImageAttachments(files) {
    return getImageAttachmentDataUrls(files).length > 0;
}

function suppressWebImageEchoes(response, files) {
    if (!hasImageAttachments(files)) return response;
    if (response?.hasGeneratedImagePlaceholder) return response;
    return {
        ...response,
        images: [],
    };
}

function arraysEqual(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function isCurrentUserMessage(message, request, files) {
    if (!message || message.role !== 'user') return false;
    const expectedText = request.historyPromptText ?? request.text ?? '';
    const actualText = message.text ?? '';
    if (actualText !== expectedText) return false;
    return arraysEqual(getMessageAttachmentDataUrls(message), getFileImages(files));
}

function omitCurrentUserMessage(history, request, files) {
    if (!Array.isArray(history) || history.length === 0) return history || [];
    let end = history.length;
    const currentBatchId = request.officialFunctionResponseBatchId;

    if (currentBatchId) {
        while (end > 0 && history[end - 1]?.officialFunctionResponseBatchId === currentBatchId) {
            end--;
        }
    }

    const trimmed = end === history.length ? history : history.slice(0, end);
    const lastMessage = trimmed[trimmed.length - 1];
    return isCurrentUserMessage(lastMessage, request, files) ? trimmed.slice(0, -1) : trimmed;
}

function assertOpenAIWebSearchSupported(model, reasoningEffort) {
    const normalizedModel = String(model || '')
        .trim()
        .toLowerCase();
    const normalizedReasoning = String(reasoningEffort || '')
        .trim()
        .toLowerCase();

    if (normalizedModel === 'gpt-4.1-nano' || normalizedModel.startsWith('gpt-4.1-nano-')) {
        throw new Error(
            'OpenAI web search is not supported for gpt-4.1-nano. Disable OpenAI web search or choose another model.'
        );
    }

    if (
        (normalizedModel === 'gpt-5' || normalizedModel.startsWith('gpt-5-')) &&
        normalizedReasoning === 'minimal'
    ) {
        throw new Error(
            'OpenAI web search is not supported for gpt-5 with minimal reasoning. Choose low/medium/high reasoning or disable OpenAI web search.'
        );
    }
}

function isOpenAIOfficialBaseUrl(baseUrl) {
    try {
        const url = new URL(baseUrl);
        return url.hostname === 'api.openai.com';
    } catch {
        return false;
    }
}

function assertOpenAIChatWebSearchSupported(model, baseUrl) {
    if (!isOpenAIOfficialBaseUrl(baseUrl)) return;

    const normalizedModel = String(model || '')
        .trim()
        .toLowerCase();
    const supportedModels = new Set([
        'gpt-5-search-api',
        'gpt-4o-search-preview',
        'gpt-4o-mini-search-preview',
    ]);

    if (!supportedModels.has(normalizedModel)) {
        throw new Error(
            'Chat Completions web search requires an OpenAI search model such as gpt-5-search-api. Use Responses API web search or choose a search model.'
        );
    }
}

async function resolveRequestHistory(request, files = request.files) {
    const overrideHistory = getRequestHistory(request);
    if (overrideHistory) return overrideHistory;
    const storedHistory = await getHistory(request.sessionId);
    return omitCurrentUserMessage(storedHistory, request, files);
}

function createContextStatusSender(request, settings) {
    return (state, detail = {}) => {
        chrome.runtime
            .sendMessage({
                action: 'GEMINI_CONTEXT_STATUS',
                sessionId: request.sessionId || null,
                state,
                mode: settings.contextMode || DEFAULT_CONTEXT_MODE,
                recentTurns:
                    detail.recentTurns ||
                    settings.contextRecentTurns ||
                    DEFAULT_CONTEXT_RECENT_TURNS,
            })
            .catch(() => {});
    };
}

function createSuccessReply(request, response, overrides = {}) {
    return {
        action: 'GEMINI_REPLY',
        sessionId: request.sessionId || null,
        text: response.text,
        thoughts: response.thoughts,
        sources: response.sources || [],
        images: response.images,
        status: 'success',
        ...overrides,
    };
}

function compactWebHistoryText(text) {
    return String(text || '').trim();
}

function describeWebHistoryAttachments(message) {
    return describeMessageAttachmentMarkers(message).join(' ');
}

function formatWebHistoryMessage(message) {
    const role = message?.role === 'ai' ? 'Assistant' : 'User';
    const text = compactWebHistoryText(message?.text);
    const attachments = describeWebHistoryAttachments(message);
    if (!text && !attachments) return null;
    return `${role}: ${[text, attachments].filter(Boolean).join(' ')}`;
}

function buildWebPromptWithHistory(currentText, history) {
    const historyLines = (Array.isArray(history) ? history : [])
        .map(formatWebHistoryMessage)
        .filter(Boolean);

    if (historyLines.length === 0) return currentText;

    return [
        'Conversation history:',
        historyLines.join('\n\n'),
        '',
        'Current user message:',
        currentText,
    ].join('\n');
}

function stripNativeWebContextIds(context = {}) {
    const { contextIds, ...authContext } = context;
    return authContext;
}

function isRefreshableWebAuthError(message = '') {
    return (
        message.includes('401') ||
        message.includes('403') ||
        message.includes('Missing Gemini Web upload tokens')
    );
}

function isUnavailableWebAuthError(message = '') {
    return (
        message.includes('未登录') ||
        message.includes('Not logged in') ||
        message.includes('Sign in') ||
        message.includes('Missing Gemini Web auth token: blValue') ||
        message.includes('Missing Gemini Web auth token: fSid')
    );
}

export class RequestDispatcher {
    constructor(authManager) {
        this.auth = authManager;
    }

    async dispatch(request, settings, files, onUpdate, signal) {
        if (settings.provider === 'official') {
            return await this._handleOfficialRequest(request, settings, files, onUpdate, signal);
        } else if (settings.provider === 'openai') {
            return await this._handleOpenAIRequest(request, settings, files, onUpdate, signal);
        } else {
            return await this._handleWebRequest(request, settings, files, onUpdate, signal);
        }
    }

    async _handleOfficialRequest(request, settings, files, onUpdate, signal) {
        if (!settings.apiKey) throw new Error('API Key is missing. Please check settings.');

        const history = await resolveRequestHistory(request, files);
        const context = await prepareManagedContext(
            request,
            settings,
            history,
            signal,
            createContextStatusSender(request, settings)
        );

        const response = await sendOfficialMessage(
            request.text,
            context.systemInstruction,
            context.history,
            {
                baseUrl: settings.officialBaseUrl,
                apiKey: settings.apiKey,
                model: request.model,
                configuredModels: settings.officialModel,
                officialUserParts: request.officialUserParts,
            },
            settings.thinkingLevel,
            files,
            settings.officialWebSearch === true,
            signal,
            onUpdate
        );

        return createSuccessReply(request, response, {
            context: null, // Official API is stateless
            thoughtSignature: response.thoughtSignature,
            officialContent: response.officialContent || null,
            functionCalls: Array.isArray(response.functionCalls) ? response.functionCalls : [],
        });
    }

    async _handleOpenAIRequest(request, settings, files, onUpdate, signal) {
        // Determine model: prioritize the one selected in UI (request.model)
        // If request.model is 'openai_custom' (legacy fallback), grab the first one from settings
        let targetModel = request.model;
        if (!targetModel || targetModel === 'openai_custom') {
            const configuredModels = settings.openaiModel ? settings.openaiModel.split(',') : [];
            targetModel = configuredModels.length > 0 ? configuredModels[0].trim() : '';
        }

        const config = {
            baseUrl: settings.openaiBaseUrl,
            apiKey: settings.openaiApiKey,
            model: targetModel,
            reasoningEffort: settings.openaiThinkingLevel,
            useResponsesApi: settings.openaiUseResponsesApi === true,
            webSearch: settings.openaiWebSearch === true,
        };

        if (config.webSearch) {
            assertOpenAIWebSearchSupported(config.model, config.reasoningEffort);
            if (!config.useResponsesApi) {
                assertOpenAIChatWebSearchSupported(config.model, config.baseUrl);
            }
        }

        const history = await resolveRequestHistory(request, files);
        const context = await prepareManagedContext(
            request,
            settings,
            history,
            signal,
            createContextStatusSender(request, settings)
        );

        const response = await sendOpenAIMessage(
            request.text,
            context.systemInstruction,
            context.history,
            config,
            files,
            signal,
            onUpdate
        );

        return createSuccessReply(request, response, {
            context: null,
        });
    }

    async _handleWebRequest(request, settings, files, onUpdate, signal) {
        // Ensure auth is possibly ready, though SessionManager usually handles initialization.

        let attemptCount = 0;
        const maxAttempts = Math.max(3, this.auth.accountIndices.length > 1 ? 3 : 2);

        if (getRequestHistory(request)) {
            throw new Error('History editing is not supported for Gemini Web Client.');
        }

        const history = await resolveRequestHistory(request, files);

        // Concatenate System Instruction for Web Client
        let fullText = request.text;
        if (request.systemInstruction) {
            fullText = request.systemInstruction + '\n\nQuestion: ' + fullText;
        }
        fullText = buildWebPromptWithHistory(fullText, history);
        const configuredThinkingLevel = request.webThinkingLevel || settings.webThinkingLevel;
        const webOptions = configuredThinkingLevel
            ? {
                  thinkingLevel: normalizeWebThinkingLevelForModel(
                      request.model,
                      configuredThinkingLevel
                  ),
              }
            : undefined;

        while (attemptCount < maxAttempts) {
            attemptCount++;

            try {
                const context = await this.auth.getOrFetchContext();
                const requestContext = stripNativeWebContextIds(context);

                const webMessageArgs = [
                    fullText,
                    requestContext,
                    request.model,
                    files,
                    signal,
                    onUpdate,
                ];
                if (webOptions) webMessageArgs.push(webOptions);
                const response = await sendWebMessage(...webMessageArgs);

                // Success! Update auth state
                await this.auth.updateContext(response.newContext, request.model);

                return createSuccessReply(request, suppressWebImageEchoes(response, files), {
                    sources: [],
                    context: null,
                });
            } catch (error) {
                const message = error.message || '';
                if (isUnavailableWebAuthError(message)) {
                    throw error;
                }

                const isLoginError = isRefreshableWebAuthError(message);

                const isNetworkGlitch =
                    message.includes('No valid response found') ||
                    message.includes('Network Error') ||
                    message.includes('Failed to fetch') ||
                    message.includes('Check network') ||
                    message.includes('429');

                if ((isLoginError || isNetworkGlitch) && attemptCount < maxAttempts) {
                    const type = isLoginError ? 'Auth' : 'Network';
                    console.warn(
                        `[Gemini Nexus] ${type} error (${error.message}), retrying... (Attempt ${attemptCount}/${maxAttempts})`
                    );

                    if (this.auth.accountIndices.length > 1) {
                        await this.auth.rotateAccount();
                    }
                    this.auth.forceContextRefresh();

                    const baseDelay = Math.pow(2, attemptCount) * 1000;
                    const jitter = Math.random() * 1000;
                    await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
                    continue;
                }

                throw error;
            }
        }
    }
}
