
// sandbox/controllers/session_flow.js
import { appendContextCompressionNotice, appendMessage } from '../render/message.js';
import { sendToBackground, saveSessionsToStorage } from '../../lib/messaging.js';
import { t } from '../core/i18n.js';

export class SessionFlowController {
    constructor(sessionManager, uiController, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.app = appController;
    }

    handleNewChat() {
        if (this.app.isGenerating) this.app.prompt.cancel();
        
        this.app.messageHandler.resetStream();
        
        const s = this.sessionManager.createSession();
        s.title = t('newChat'); 
        this.switchToSession(s.id);
    }

    switchToSession(sessionId) {
        if (this.app.isGenerating) this.app.prompt.cancel();

        this.app.messageHandler.resetStream();
        this.sessionManager.setCurrentId(sessionId);
        
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        this.ui.clearChatHistory();
        const compressionNoticeIndex = this.getCompressionNoticeIndex(session);
        session.messages.forEach((msg, index) => {
            if (index === compressionNoticeIndex) {
                this.appendRestoredCompressionNotice();
            }

            let attachment = null;
            if (msg.role === 'user') attachment = msg.image;
            if (msg.role === 'ai') attachment = msg.generatedImages;
            // Pass msg.thoughts to appendMessage
            appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, msg.sources, {
                onEdit: msg.role === 'user'
                    ? this.app.prompt.getMessageEditOptions(index).onEdit
                    : null
            });
        });
        if (compressionNoticeIndex === session.messages.length) {
            this.appendRestoredCompressionNotice();
        }
        this.ui.scrollToBottom();

        this.app.boundSessionId = sessionId;
        this.app.saveCurrentTabSessionBinding(sessionId);

        if (session.context) {
            sendToBackground({
                action: "SET_CONTEXT",
                context: session.context,
                model: this.app.getSelectedModel()
            });
        } else {
            sendToBackground({ action: "RESET_CONTEXT" });
        }

        this.refreshHistoryUI();
        this.ui.resetInput();
    }

    refreshHistoryUI() {
        this.ui.renderHistoryList(
            this.sessionManager.getSortedSessions(),
            this.sessionManager.currentSessionId,
            {
                onSwitch: (id) => this.switchToSession(id),
                onDelete: (id) => this.handleDeleteSession(id)
            }
        );
    }

    getCompressionNoticeIndex(session) {
        const sourceMessageCount = session?.contextSummary?.sourceMessageCount;
        if (!Number.isInteger(sourceMessageCount) || sourceMessageCount <= 0) return -1;
        const messageCount = Array.isArray(session.messages) ? session.messages.length : 0;
        return Math.min(sourceMessageCount, messageCount);
    }

    appendRestoredCompressionNotice() {
        appendContextCompressionNotice(this.ui.historyDiv, t('contextCompressed'), {
            complete: true,
            scroll: false
        });
    }

    handleDeleteSession(sessionId) {
        const switchNeeded = this.sessionManager.deleteSession(sessionId);
        saveSessionsToStorage(this.sessionManager.sessions);
        
        if (switchNeeded) {
            if (this.sessionManager.sessions.length > 0) {
                this.switchToSession(this.sessionManager.currentSessionId);
            } else {
                this.handleNewChat();
            }
        } else {
            this.refreshHistoryUI();
        }
    }
}
