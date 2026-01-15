
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
        this.isEditing = false;
        this.editMessageIndex = null;
        this.isRegenerating = false;
        this.regenerateIndex = null;
        this.regenerateUserMessageIndex = null;
        this.skipUserMessageForHandler = false;
    }

    async send(skipUserMessageRender = false, skipUserMessageAdd = false) {
        console.log('📤 prompt.send() called with skip params:', { skipUserMessageRender, skipUserMessageAdd });
        console.log('📝 Input value:', this.ui.inputFn.value);
        console.log('🖼️ Files:', this.imageManager.getFiles());

        if (this.app.isGenerating) return;

        const text = this.ui.inputFn.value.trim();
        const files = this.imageManager.getFiles();

        if (!text && files.length === 0) {
            console.log('❌ No text or files to send');
            return;
        }

        console.log('✅ Proceeding with send, text:', text);

        // Check if we're in edit mode
        if (this.app && this.app.sessionFlow && this.app.sessionFlow.editingMessageData) {
            this.isEditing = true;
            this.editMessageIndex = this.app.sessionFlow.editingMessageData.messageIndex;
        } else {
            this.isEditing = false;
            this.editMessageIndex = null;
        }

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

        const displayAttachments = files.map(f => f.base64);

        // If editing, delete the message and all subsequent messages
        if (this.isEditing && this.editMessageIndex !== null) {
            console.log('[prompt.send] Editing message at index:', this.editMessageIndex, 'session.messages.length before:', session.messages.length);
            this.sessionManager.deleteMessage(currentId, this.editMessageIndex);
            console.log('[prompt.send] After deletion, session.messages.length:', session.messages.length);

            // Clear and re-render the chat history without the deleted messages
            this.ui.clearChatHistory();
            session.messages.forEach((msg, index) => {
                let attachment = null;
                if (msg.role === 'user') attachment = msg.image;
                if (msg.role === 'ai') attachment = msg.generatedImages;
                console.log('[prompt.send] Re-rendering remaining message at index:', index, 'role:', msg.role);
                appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index);
            });

            // Cancel edit mode
            if (this.app && this.app.sessionFlow) {
                this.app.sessionFlow.cancelEdit();
            } else {
                // Clear our local edit state if sessionFlow is not available
                this.isEditing = false;
                this.editMessageIndex = null;
            }
        }

        // Render User Message if not skipped
        if (!skipUserMessageRender) {
            const messageIndex = session.messages.length; // New message will be at this index
            console.log('[prompt.send] Adding new/edited user message at index:', messageIndex, 'text:', text);

            appendMessage(
                this.ui.historyDiv,
                text,
                'user',
                displayAttachments.length > 0 ? displayAttachments : null,
                null,
                messageIndex
            );
        }

        // Add message to session if not skipped
        if (!skipUserMessageAdd) {
            this.sessionManager.addMessage(currentId, 'user', text, displayAttachments.length > 0 ? displayAttachments : null);
            saveSessionsToStorage(this.sessionManager.sessions);
            this.app.sessionFlow.refreshHistoryUI();
        }

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

        // Store the skip params for use in message handler
        this.skipUserMessageForHandler = skipUserMessageAdd;

        const conn = (this.ui && this.ui.settings && this.ui.settings.connectionData) ? this.ui.settings.connectionData : {};
        let activeMcpServer = null;
        if (conn && Array.isArray(conn.mcpServers) && conn.mcpServers.length > 0) {
            const activeId = conn.mcpActiveServerId;
            activeMcpServer = conn.mcpServers.find(s => s && s.id === activeId) || conn.mcpServers[0];
        } else if (conn && (conn.mcpServerUrl || conn.mcpTransport)) {
            activeMcpServer = {
                id: null,
                name: '',
                transport: conn.mcpTransport || 'sse',
                url: conn.mcpServerUrl || '',
                enabled: true,
                toolMode: 'all',
                enabledTools: []
            };
        }

        const enableMcpTools = conn.mcpEnabled === true &&
            !!(activeMcpServer && activeMcpServer.enabled !== false && activeMcpServer.url && activeMcpServer.url.trim());

        console.log('🚀 Sending message to background:', { text, model: selectedModel });

        sendToBackground({
            action: "SEND_PROMPT",
            text: text,
            files: files, // Send full file objects array
            model: selectedModel,
            includePageContext: this.app.pageContextActive,
            enableBrowserControl: this.app.browserControlActive, // Pass browser control state
            enableMcpTools: enableMcpTools,
            mcpTransport: activeMcpServer ? (activeMcpServer.transport || "sse") : "sse",
            mcpServerUrl: activeMcpServer ? (activeMcpServer.url || "") : "",
            mcpServerId: activeMcpServer ? activeMcpServer.id : null,
            mcpToolMode: activeMcpServer && activeMcpServer.toolMode ? activeMcpServer.toolMode : 'all',
            mcpEnabledTools: activeMcpServer && Array.isArray(activeMcpServer.enabledTools) ? activeMcpServer.enabledTools : [],
            sessionId: currentId // Important: Pass session ID so background can save history independently
        });

        console.log('✅ Message sent to background');
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
