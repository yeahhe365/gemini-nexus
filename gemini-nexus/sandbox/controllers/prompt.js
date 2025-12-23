
// sandbox/controllers/prompt.js
import { appendMessage } from '../render/message.js';
import { sendToBackground, saveSessionsToStorage } from '../../lib/messaging.js';
import { t } from '../core/i18n.js';

export class PromptController {
    constructor(sessionManager, uiController, imageManager, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        this.app = appController;
        this.cancellationTimestamp = 0;
    }

    async send() {
        if (this.app.isGenerating) return;

        const text = this.ui.inputFn.value.trim();
        const files = this.imageManager.getFiles();

        if (!text && files.length === 0) return;

        if (!this.sessionManager.currentSessionId) {
            this.sessionManager.createSession();
        }

        const currentId = this.sessionManager.currentSessionId;
        const session = this.sessionManager.getCurrentSession();

        // Update Title if needed
        if (session.messages.length === 0) {
            const titleUpdate = this.sessionManager.updateTitle(currentId, text || t('imageSent'));
            if(titleUpdate) this.app.sessionFlow.refreshHistoryUI();
        }

        // Render User Message
        const displayAttachments = files.map(f => f.base64);
        
        appendMessage(
            this.ui.historyDiv, 
            text, 
            'user', 
            displayAttachments.length > 0 ? displayAttachments : null
        );
        
        this.sessionManager.addMessage(currentId, 'user', text, displayAttachments.length > 0 ? displayAttachments : null);
        
        saveSessionsToStorage(this.sessionManager.sessions);
        this.app.sessionFlow.refreshHistoryUI();

        // Prepare Context & Model
        const selectedModel = this.app.getSelectedModel();
        
        if (session.context) {
             sendToBackground({
                action: "SET_CONTEXT",
                context: session.context,
                model: selectedModel
            });
        }

        this.ui.resetInput();
        this.imageManager.clearFile();
        
        this.app.isGenerating = true;
        this.ui.setLoading(true);

        sendToBackground({ 
            action: "SEND_PROMPT", 
            text: text,
            files: files, // Send full file objects array
            model: selectedModel,
            includePageContext: this.app.pageContextActive,
            enableBrowserControl: this.app.browserControlActive, // Pass browser control state
            sessionId: currentId // Important: Pass session ID so background can save history independently
        });
    }

    cancel() {
        if (!this.app.isGenerating) return;
        
        this.cancellationTimestamp = Date.now();
        
        sendToBackground({ action: "CANCEL_PROMPT" });
        this.app.messageHandler.resetStream();
        
        this.app.isGenerating = false;
        this.ui.setLoading(false);
        this.ui.updateStatus(t('cancelled'));
    }

    isCancellationRecent() {
        return (Date.now() - this.cancellationTimestamp) < 2000; // 2s window
    }
}