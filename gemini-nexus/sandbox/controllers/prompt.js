
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

        const conn = (this.ui && this.ui.settings && this.ui.settings.connectionData) ? this.ui.settings.connectionData : {};

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

        // For backward compatibility, also send first server info as legacy fields
        const firstServer = mcpServers[0] || null;

        sendToBackground({
            action: "SEND_PROMPT",
            text: text,
            files: files,
            model: selectedModel,
            includePageContext: this.app.pageContextActive,
            enableBrowserControl: this.app.browserControlActive,
            enableMcpTools: enableMcpTools,
            // Multi-server: pass all enabled servers
            mcpServers: mcpServers,
            // Legacy fields for backward compatibility
            mcpTransport: firstServer ? (firstServer.transport || "sse") : "sse",
            mcpServerUrl: firstServer ? (firstServer.url || "") : "",
            mcpServerId: firstServer ? firstServer.id : null,
            mcpToolMode: firstServer && firstServer.toolMode ? firstServer.toolMode : 'all',
            mcpEnabledTools: firstServer && Array.isArray(firstServer.enabledTools) ? firstServer.enabledTools : [],
            sessionId: currentId
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
