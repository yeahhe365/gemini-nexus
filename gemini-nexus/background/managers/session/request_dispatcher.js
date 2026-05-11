
// background/managers/session/request_dispatcher.js
import { sendOfficialMessage } from '../../../services/providers/official.js';
import { sendWebMessage } from '../../../services/providers/web.js';
import { sendOpenAIMessage } from '../../../services/providers/openai_compatible.js';
import { DEFAULT_CONTEXT_RECENT_TURNS } from '../../../lib/constants.js';
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
    return files.map(file => file?.base64).filter(Boolean);
}

function normalizeMessageImages(image) {
    if (!image) return [];
    return Array.isArray(image) ? image.filter(Boolean) : [image];
}

function arraysEqual(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function isCurrentUserMessage(message, request) {
    if (!message || message.role !== 'user') return false;
    const expectedText = request.historyPromptText ?? request.text ?? '';
    const actualText = message.text ?? '';
    if (actualText !== expectedText) return false;
    return arraysEqual(normalizeMessageImages(message.image), getFileImages(request.files));
}

function omitCurrentUserMessage(history, request) {
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
    return isCurrentUserMessage(lastMessage, request) ? trimmed.slice(0, -1) : trimmed;
}

function assertOpenAIWebSearchSupported(model, reasoningEffort) {
    const normalizedModel = String(model || '').trim().toLowerCase();
    const normalizedReasoning = String(reasoningEffort || '').trim().toLowerCase();

    if (normalizedModel === 'gpt-4.1-nano' || normalizedModel.startsWith('gpt-4.1-nano-')) {
        throw new Error("OpenAI web search is not supported for gpt-4.1-nano. Disable OpenAI web search or choose another model.");
    }

    if ((normalizedModel === 'gpt-5' || normalizedModel.startsWith('gpt-5-')) && normalizedReasoning === 'minimal') {
        throw new Error("OpenAI web search is not supported for gpt-5 with minimal reasoning. Choose low/medium/high reasoning or disable OpenAI web search.");
    }
}

async function resolveRequestHistory(request) {
    const overrideHistory = getRequestHistory(request);
    if (overrideHistory) return overrideHistory;
    const storedHistory = await getHistory(request.sessionId);
    return omitCurrentUserMessage(storedHistory, request);
}

function createContextStatusSender(request, settings) {
    return (state, detail = {}) => {
        chrome.runtime.sendMessage({
            action: "GEMINI_CONTEXT_STATUS",
            sessionId: request.sessionId || null,
            state,
            mode: settings.contextMode || 'summary',
            recentTurns: detail.recentTurns || settings.contextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS
        }).catch(() => {});
    };
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
            return await this._handleWebRequest(request, files, onUpdate, signal);
        }
    }

    async _handleOfficialRequest(request, settings, files, onUpdate, signal) {
        if (!settings.apiKey) throw new Error("API Key is missing. Please check settings.");
        
        // Fetch History
        const history = await resolveRequestHistory(request);
        const context = await prepareManagedContext(request, settings, history, signal, createContextStatusSender(request, settings));

        const response = await sendOfficialMessage(
            request.text, 
            context.systemInstruction,
            context.history,
            {
                baseUrl: settings.officialBaseUrl,
                apiKey: settings.apiKey,
                model: request.model,
                configuredModels: settings.officialModel,
                officialUserParts: request.officialUserParts
            },
            settings.thinkingLevel, 
            files, 
            settings.officialWebSearch === true,
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            sessionId: request.sessionId || null,
            text: response.text,
            thoughts: response.thoughts,
            sources: response.sources || [],
            images: response.images,
            status: "success",
            context: null, // Official API is stateless
            thoughtSignature: response.thoughtSignature,
            officialContent: response.officialContent || null,
            functionCalls: Array.isArray(response.functionCalls) ? response.functionCalls : []
        };
    }

    async _handleOpenAIRequest(request, settings, files, onUpdate, signal) {
        // Determine model: prioritize the one selected in UI (request.model)
        // If request.model is 'openai_custom' (legacy fallback), grab the first one from settings
        let targetModel = request.model;
        if (!targetModel || targetModel === 'openai_custom') {
            const configuredModels = settings.openaiModel ? settings.openaiModel.split(',') : [];
            targetModel = configuredModels.length > 0 ? configuredModels[0].trim() : "";
        }

        const config = {
            baseUrl: settings.openaiBaseUrl,
            apiKey: settings.openaiApiKey,
            model: targetModel,
            reasoningEffort: settings.openaiThinkingLevel,
            useResponsesApi: settings.openaiUseResponsesApi === true,
            webSearch: settings.openaiWebSearch === true
        };

        if (config.webSearch) {
            assertOpenAIWebSearchSupported(config.model, config.reasoningEffort);
        }

        const history = await resolveRequestHistory(request);
        const context = await prepareManagedContext(request, settings, history, signal, createContextStatusSender(request, settings));

        const response = await sendOpenAIMessage(
            request.text,
            context.systemInstruction,
            context.history,
            config,
            files,
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            sessionId: request.sessionId || null,
            text: response.text,
            thoughts: response.thoughts,
            sources: response.sources || [],
            images: response.images,
            status: "success",
            context: null
        };
    }

    async _handleWebRequest(request, files, onUpdate, signal) {
        // Ensure auth is possibly ready, though SessionManager usually handles initialization.
        
        let attemptCount = 0;
        const maxAttempts = Math.max(3, this.auth.accountIndices.length > 1 ? 3 : 2);

        if (getRequestHistory(request)) {
            throw new Error("History editing is not supported for Gemini Web Client.");
        }

        // Concatenate System Instruction for Web Client
        let fullText = request.text;
        if (request.systemInstruction) {
            fullText = request.systemInstruction + "\n\nQuestion: " + fullText;
        }

        while (attemptCount < maxAttempts) {
            attemptCount++;
            
            try {
                this.auth.checkModelChange(request.model);
                const context = await this.auth.getOrFetchContext();
                
                const response = await sendWebMessage(
                    fullText, 
                    context, 
                    request.model, 
                    files, 
                    signal,
                    onUpdate
                );

                // Success! Update auth state
                await this.auth.updateContext(response.newContext, request.model);

                return {
                    action: "GEMINI_REPLY",
                    sessionId: request.sessionId || null,
                    text: response.text,
                    thoughts: response.thoughts,
                    sources: [],
                    images: response.images,
                    status: "success",
                    context: response.newContext 
                };

            } catch (err) {
                const isLoginError = err.message && (
                    err.message.includes("未登录") || 
                    err.message.includes("Not logged in") || 
                    err.message.includes("Sign in") || 
                    err.message.includes("401") || 
                    err.message.includes("403")
                );
                
                const isNetworkGlitch = err.message && (
                    err.message.includes("No valid response found") ||
                    err.message.includes("Network Error") ||
                    err.message.includes("Failed to fetch") ||
                    err.message.includes("Check network") ||
                    err.message.includes("429")
                );
                
                if ((isLoginError || isNetworkGlitch) && attemptCount < maxAttempts) {
                    const type = isLoginError ? "Auth" : "Network";
                    console.warn(`[Gemini Nexus] ${type} error (${err.message}), retrying... (Attempt ${attemptCount}/${maxAttempts})`);
                    
                    if (isLoginError || isNetworkGlitch) {
                         if (this.auth.accountIndices.length > 1) {
                             await this.auth.rotateAccount();
                         }
                         this.auth.forceContextRefresh();
                    }
                    
                    const baseDelay = Math.pow(2, attemptCount) * 1000;
                    const jitter = Math.random() * 1000;
                    await new Promise(r => setTimeout(r, baseDelay + jitter));
                    continue; 
                }
                
                throw err;
            }
        }
    }
}
