
// background/handlers/session/quick_ask_handler.js
import { saveToHistory } from '../../managers/history_manager.js';

export class QuickAskHandler {
    constructor(sessionManager, imageHandler) {
        this.sessionManager = sessionManager;
        this.imageHandler = imageHandler;
    }

    async handleQuickAsk(request, sender) {
        const tabId = sender.tab ? sender.tab.id : null;
        
        if (!request.sessionId) {
            await this.sessionManager.resetContext();
        } else {
            await this.sessionManager.ensureInitialized();
        }

        const onUpdate = (partialText, partialThoughts) => {
            if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                    action: "GEMINI_STREAM_UPDATE",
                    text: partialText,
                    thoughts: partialThoughts
                }).catch(() => {});
            }
        };

        const result = await this.sessionManager.handleSendPrompt(request, onUpdate);
        
        let savedSession = null;
        if (result && result.status === 'success') {
            savedSession = await saveToHistory(request.text, result, null);
        }

        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                action: "GEMINI_STREAM_DONE",
                result: result,
                sessionId: savedSession ? savedSession.id : null
            }).catch(() => {});
        }
    }

    async handleQuickAskImage(request, sender) {
        const tabId = sender.tab ? sender.tab.id : null;

        const imgRes = await this.imageHandler.fetchImage(request.url);
        
        if (imgRes.error) {
            if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                    action: "GEMINI_STREAM_DONE",
                    result: { status: "error", text: "Failed to load image: " + imgRes.error }
                }).catch(() => {});
            }
            return;
        }

        const promptRequest = {
            text: request.text,
            model: request.model,
            files: [{
                base64: imgRes.base64,
                type: imgRes.type,
                name: imgRes.name
            }]
        };

        await this.sessionManager.resetContext();

        const onUpdate = (partialText, partialThoughts) => {
            if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                    action: "GEMINI_STREAM_UPDATE",
                    text: partialText,
                    thoughts: partialThoughts
                }).catch(() => {});
            }
        };

        const result = await this.sessionManager.handleSendPrompt(promptRequest, onUpdate);
        
        let savedSession = null;
        if (result && result.status === 'success') {
            savedSession = await saveToHistory(request.text, result, [{ base64: imgRes.base64 }]);
        }

        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                action: "GEMINI_STREAM_DONE",
                result: result,
                sessionId: savedSession ? savedSession.id : null
            }).catch(() => {});
        }
    }
}
