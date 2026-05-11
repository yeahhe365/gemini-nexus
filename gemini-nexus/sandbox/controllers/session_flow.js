
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
        this.enterDraft();
    }

    enterDraft() {
        this.app.messageHandler.resetStream();
        this.sessionManager.enterDraft();
        this.app.boundSessionId = null;
        this.app.saveCurrentTabSessionBinding(null);
        sendToBackground({ action: "RESET_CONTEXT" });
        this.ui.clearChatHistory();
        this.ui.resetInput();
        this.refreshHistoryUI();
    }

    switchToSession(sessionId, options = {}) {
        this.app.messageHandler.resetStream();
        this.sessionManager.setCurrentId(sessionId);
        
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        this.ui.clearChatHistory();
        const compressionNoticeIndex = this.getCompressionNoticeIndex(session);
        session.messages.forEach((msg, index) => {
            if (this.shouldSkipRestoredMessage(msg)) return;

            if (index === compressionNoticeIndex) {
                this.appendRestoredCompressionNotice();
            }

            let attachment = null;
            if (msg.role === 'user') attachment = msg.image;
            if (msg.role === 'ai') attachment = msg.generatedImages;
            // Pass msg.thoughts to appendMessage
            appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, msg.sources, {
                kind: this.getMessageKind(msg),
                toolName: this.getRestoredToolName(msg),
                step: this.getRestoredToolStep(msg),
                toolStatus: this.getRestoredToolStatus(msg),
                toolCallText: this.getRestoredToolCallText(msg),
                callIndex: this.getRestoredToolCallIndex(msg),
                callCount: this.getRestoredToolCallCount(msg),
                suppressCopy: msg.suppressCopy === true,
                isCollapsed: true,
                thoughtsDurationSeconds: msg.thoughtsDurationSeconds,
                autoScroll: false,
                onEdit: msg.role === 'user' && this.getMessageKind(msg) !== 'tool-output'
                    ? this.app.prompt.getMessageEditOptions(index).onEdit
                    : null
            });
        });
        if (compressionNoticeIndex === session.messages.length) {
            this.appendRestoredCompressionNotice();
        }
        this.app.messageHandler.restoreStreamForSession(sessionId);
        if (options.restoreScrollState && this.ui.restoreChatScrollState) {
            this.ui.restoreChatScrollState(options.restoreScrollState);
        } else {
            this.ui.scrollToBottom(options.scrollOptions);
        }

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
            },
            {
                isGenerating: this.app.isGenerating,
                generatingSessionId: this.app.generatingSessionId
            }
        );
    }

    shouldSkipRestoredMessage(message) {
        if (!message) return false;
        if (message.officialContent && !this.hasDisplayableRestoredContent(message)) return true;
        if (message.role !== 'ai') return false;
        return !this.hasDisplayableRestoredContent(message);
    }

    hasDisplayableRestoredContent(message) {
        const text = typeof message.text === 'string' ? message.text : '';
        const thoughts = typeof message.thoughts === 'string' ? message.thoughts : '';
        return Boolean(text.trim() || thoughts.trim());
    }

    getMessageKind(message) {
        if (!message || message.role !== 'user' || typeof message.text !== 'string') {
            return null;
        }
        if (message.kind === 'tool-output') return 'tool-output';
        return message.text.startsWith('[Tool Output:') ? 'tool-output' : null;
    }

    getRestoredToolName(message) {
        if (this.getMessageKind(message) !== 'tool-output') return '';
        if (message.toolName) return message.toolName;
        const match = message.text.match(/^\[Tool Output:\s*([^\]]+)\]/);
        return match ? match[1].trim() : '';
    }

    getRestoredToolStep(message) {
        if (this.getMessageKind(message) !== 'tool-output') return '';
        if (message.toolStep) return message.toolStep;
        const match = message.text.match(/\n\n\[Proceeding to step\s+(\d+)\]\s*$/);
        return match ? match[1] : '';
    }

    getRestoredToolStatus(message) {
        if (this.getMessageKind(message) !== 'tool-output') return 'completed';
        return message.toolStatus || 'completed';
    }

    getRestoredToolCallText(message) {
        if (this.getMessageKind(message) !== 'tool-output') return '';
        return message.toolCallText || '';
    }

    getRestoredToolCallIndex(message) {
        if (this.getMessageKind(message) !== 'tool-output') return '';
        return message.toolCallIndex || '';
    }

    getRestoredToolCallCount(message) {
        if (this.getMessageKind(message) !== 'tool-output') return '';
        return message.toolCallCount || '';
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
        saveSessionsToStorage(this.sessionManager.getPersistableSessions());
        
        if (switchNeeded) {
            if (this.sessionManager.sessions.length > 0) {
                this.switchToSession(this.sessionManager.currentSessionId);
            } else {
                this.enterDraft();
            }
        } else {
            this.refreshHistoryUI();
        }
    }
}
