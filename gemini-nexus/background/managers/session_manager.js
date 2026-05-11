
// background/managers/session_manager.js
import { AuthManager } from './auth_manager.js';
import { getConnectionSettings } from './session/settings_store.js';
import { RequestDispatcher } from './session/request_dispatcher.js';

export class GeminiSessionManager {
    constructor() {
        this.auth = new AuthManager();
        this.dispatcher = new RequestDispatcher(this.auth);
        this.abortController = null;
    }

    async ensureInitialized() {
        await this.auth.ensureInitialized();
    }

    async handleSendPrompt(request, onUpdate) {
        // Cancel previous if exists
        this.cancelCurrentRequest();
        
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        let thoughtsStartedAt = null;
        let thoughtsDurationSeconds = null;
        const trackedOnUpdate = (partialText, partialThoughts) => {
            if (typeof partialThoughts === 'string' && partialThoughts.trim()) {
                if (!thoughtsStartedAt) {
                    thoughtsStartedAt = Date.now();
                }
                thoughtsDurationSeconds = (Date.now() - thoughtsStartedAt) / 1000;
            }
            onUpdate(partialText, partialThoughts);
        };

        try {
            const settings = await getConnectionSettings();
            
            // Normalize files
            let files = [];
            if (request.files && Array.isArray(request.files)) {
                files = request.files;
            } else if (request.image) {
                files = [{
                    base64: request.image, 
                    type: request.imageType,
                    name: request.imageName || "image.png"
                }];
            }

            // Ensure Auth is ready for Web provider (Dispatcher relies on AuthManager)
            if (settings.provider === 'web') {
                await this.ensureInitialized();
            }

            const result = await this.dispatcher.dispatch(request, settings, files, trackedOnUpdate, signal);
            if (result?.thoughts) {
                result.thoughtsDurationSeconds = thoughtsStartedAt
                    ? (Date.now() - thoughtsStartedAt) / 1000
                    : (thoughtsDurationSeconds ?? 0);
            }
            return result;

        } catch (error) {
            if (error.name === 'AbortError') return null;

            console.error("Gemini Error:", error);
            
            let errorMessage = error.message || "Unknown error";
            const isZh = chrome.i18n.getUILanguage().startsWith('zh');

            // Handle common user-facing errors
            if(errorMessage.includes("未登录") || errorMessage.includes("Not logged in")) {
                this.auth.forceContextRefresh();
                await chrome.storage.local.remove(['geminiContext']);
                
                const currentIndex = this.auth.getCurrentIndex();
                if (isZh) {
                    errorMessage = `账号 (Index: ${currentIndex}) 未登录或会话已过期。请前往 <a href="https://gemini.google.com/u/${currentIndex}/" target="_blank" style="color: inherit; text-decoration: underline;">gemini.google.com/u/${currentIndex}/</a> 登录。`;
                } else {
                    errorMessage = `Account (Index: ${currentIndex}) not logged in. Please log in at <a href="https://gemini.google.com/u/${currentIndex}/" target="_blank" style="color: inherit; text-decoration: underline;">gemini.google.com/u/${currentIndex}/</a>.`;
                }
            } else if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
                errorMessage = isZh ? "请求过于频繁，请稍后再试 (429)" : "Too many requests, please try again later (429)";
            }
            
            return {
                action: "GEMINI_REPLY",
                sessionId: request.sessionId || null,
                text: "Error: " + errorMessage,
                status: "error"
            };
        } finally {
            this.abortController = null;
        }
    }

    cancelCurrentRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            return true;
        }
        return false;
    }

    async setContext(context, model) {
        await this.auth.updateContext(context, model);
    }

    async resetContext() {
        await this.auth.resetContext();
    }
}
