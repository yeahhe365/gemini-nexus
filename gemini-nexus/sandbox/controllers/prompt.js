
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

    buildRequestPayload(text, files, sessionId, extra = {}) {
        const selectedModel = this.app.getSelectedModel();
        const conn = this.getConnectionData();

        // Multi-server MCP: collect all enabled servers
        let mcpServers = [];
        if (conn && Array.isArray(conn.mcpServers) && conn.mcpServers.length > 0) {
            mcpServers = conn.mcpServers.filter(s => s && s.enabled !== false && s.url && s.url.trim());
        } else if (conn && (conn.mcpServerUrl || conn.mcpTransport)) {
            // Legacy single-server fallback
            mcpServers = [{
                id: '_legacy_',
                name: '',
                transport: conn.mcpTransport || 'sse',
                url: conn.mcpServerUrl || '',
                enabled: true,
                toolMode: 'all',
                enabledTools: []
            }];
        }

        const enableMcpTools = conn.mcpEnabled === true && mcpServers.length > 0;
        const firstServer = mcpServers[0] || null;

        return {
            action: "SEND_PROMPT",
            text,
            files,
            model: selectedModel,
            includePageContext: this.app.pageContextActive,
            enableBrowserControl: this.app.browserControlActive,
            enableMcpTools,
            mcpServers,
            mcpTransport: firstServer ? (firstServer.transport || "sse") : "sse",
            mcpServerUrl: firstServer ? (firstServer.url || "") : "",
            mcpServerId: firstServer ? firstServer.id : null,
            mcpToolMode: firstServer && firstServer.toolMode ? firstServer.toolMode : 'all',
            mcpEnabledTools: firstServer && Array.isArray(firstServer.enabledTools) ? firstServer.enabledTools : [],
            sessionId,
            ...extra
        };
    }

    getConnectionData() {
        return (this.ui && this.ui.settings && this.ui.settings.connectionData)
            ? this.ui.settings.connectionData
            : {};
    }

    getConnectionProvider() {
        const conn = this.getConnectionData();
        if (conn.provider) return conn.provider;
        return conn.useOfficialApi === true ? 'official' : 'web';
    }

    canEditHistory() {
        return this.getConnectionProvider() !== 'web';
    }

    getMessageEditOptions(messageIndex) {
        if (!this.canEditHistory()) return {};

        return {
            onEdit: (nextText) => this.resendFromMessage(messageIndex, nextText)
        };
    }

    setGeneratingState(isGenerating, sessionId = null) {
        this.app.isGenerating = isGenerating;
        this.app.generatingSessionId = isGenerating ? sessionId : null;
        this.ui.setLoading(isGenerating);
        this.app.sessionFlow.refreshHistoryUI();
    }

    normalizeMessageImages(image) {
        if (!image) return [];
        return Array.isArray(image) ? image.filter(Boolean) : [image];
    }

    buildFilesFromImages(images) {
        return images.map((base64, index) => {
            const mimeMatch = typeof base64 === 'string' ? base64.match(/^data:([^;]+);/) : null;
            const type = mimeMatch ? mimeMatch[1] : 'image/png';
            const ext = type.split('/')[1] || 'png';
            return {
                base64,
                type,
                name: `edited-message-${index + 1}.${ext}`
            };
        });
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
        if (!session) return;

        // Update Title if needed
        if (session.messages.length === 0) {
            const titleUpdate = this.sessionManager.updateTitle(currentId, text || t('imageSent'));
            if(titleUpdate) this.app.sessionFlow.refreshHistoryUI();
        }

        // Render User Message
        const displayAttachments = files.map(f => f.base64);
        
        const messageIndex = session.messages.length;

        appendMessage(
            this.ui.historyDiv, 
            text, 
            'user', 
            displayAttachments.length > 0 ? displayAttachments : null,
            null,
            null,
            this.getMessageEditOptions(messageIndex)
        );
        
        this.sessionManager.addMessage(currentId, 'user', text, displayAttachments.length > 0 ? displayAttachments : null);
        
        saveSessionsToStorage(this.sessionManager.getPersistableSessions());
        this.app.sessionFlow.switchToSession(currentId);

        if (session.context) {
             sendToBackground({
                action: "SET_CONTEXT",
                context: session.context,
                model: this.app.getSelectedModel()
            });
        }

        this.ui.resetInput();
        this.imageManager.clearFile();
        
        this.setGeneratingState(true, currentId);

        sendToBackground(this.buildRequestPayload(text, files, currentId));
    }

    async resendFromMessage(messageIndex, editedText) {
        if (this.app.isGenerating) return false;
        if (!this.canEditHistory()) {
            this.ui.updateStatus(t('editNotSupportedForWeb'));
            setTimeout(() => {
                if (!this.app.isGenerating) this.ui.updateStatus("");
            }, 3000);
            return false;
        }

        const currentId = this.sessionManager.currentSessionId;
        const session = this.sessionManager.getCurrentSession();
        if (!session || !Array.isArray(session.messages)) return false;

        const target = session.messages[messageIndex];
        const images = this.normalizeMessageImages(target?.image);
        const nextText = (editedText || '').trim();
        if (!target || target.role !== 'user' || (!nextText && images.length === 0)) {
            return false;
        }

        const editResult = this.sessionManager.editUserMessageAndTruncate(currentId, messageIndex, nextText);
        if (!editResult) return false;

        saveSessionsToStorage(this.sessionManager.getPersistableSessions());
        this.app.sessionFlow.refreshHistoryUI();
        this.app.rerender();

        const files = this.buildFilesFromImages(images);
        this.imageManager.clearFile();
        this.ui.resetInput();
        this.setGeneratingState(true, currentId);

        sendToBackground(this.buildRequestPayload(nextText, files, currentId, {
            historyOverride: editResult.previousMessages,
            sessionSnapshot: editResult.session
        }));

        return true;
    }

    cancel() {
        if (!this.app.isGenerating) return;
        
        this.cancellationTimestamp = Date.now();
        
        sendToBackground({ action: "CANCEL_PROMPT" });
        this.app.messageHandler.clearActiveStream();
        
        this.app.isGenerating = false;
        this.app.generatingSessionId = null;
        this.ui.setLoading(false);
        this.app.sessionFlow.refreshHistoryUI();
        this.ui.updateStatus(t('cancelled'));
    }

    isCancellationRecent() {
        return (Date.now() - this.cancellationTimestamp) < 2000; // 2s window
    }
}
