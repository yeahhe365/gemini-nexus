import { appendMessage } from '../render/message.js';
import { appendContextCompressionNotice } from '../render/context_compression.js';
import { copyToClipboard } from '../render/clipboard.js';
import {
    downloadTextFile,
    sendToBackground,
    saveGroupsToStorage,
    saveSessionsToStorage,
} from '../../shared/messaging/index.js';
import { hasDisplayableText, hasDisplayableThoughts } from '../core/displayable_content.js';
import { t } from '../core/i18n.js';
import {
    buildSessionExportFilename,
    buildSessionTextExport,
    serializeSessionForExport,
} from '../core/session_export.js';

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
        sendToBackground({ action: 'RESET_CONTEXT' });
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
        session.messages.forEach((message, index) => {
            if (this.shouldSkipRestoredMessage(message)) return;

            if (index === compressionNoticeIndex) {
                this.appendRestoredCompressionNotice();
            }

            let attachment = null;
            if (message.role === 'user') attachment = message.attachments || message.image;
            if (message.role === 'ai') attachment = message.generatedImages;
            appendMessage(
                this.ui.historyDiv,
                message.text,
                message.role,
                attachment,
                message.thoughts,
                message.sources,
                {
                    kind: this.getMessageKind(message),
                    toolName: this.getRestoredToolName(message),
                    step: this.getRestoredToolStep(message),
                    toolStatus: this.getRestoredToolStatus(message),
                    toolCallText: this.getRestoredToolCallText(message),
                    callIndex: this.getRestoredToolCallIndex(message),
                    callCount: this.getRestoredToolCallCount(message),
                    suppressCopy: message.suppressCopy === true,
                    isCollapsed: true,
                    thoughtsDurationSeconds: message.thoughtsDurationSeconds,
                    autoScroll: false,
                    onEdit:
                        message.role === 'user' && this.getMessageKind(message) !== 'tool-output'
                            ? this.app.prompt.getMessageEditOptions(index).onEdit
                            : null,
                }
            );
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
                action: 'SET_CONTEXT',
                context: session.context,
                model: this.app.getSelectedModel(),
            });
        } else {
            sendToBackground({ action: 'RESET_CONTEXT' });
        }

        this.refreshHistoryUI();
        this.ui.resetInput();
    }

    refreshHistoryUI() {
        this.ui.renderHistoryList(
            this.sessionManager.getSortedSessions(),
            this.sessionManager.getSortedGroups(),
            this.sessionManager.currentSessionId,
            {
                onSwitch: (id) => this.switchToSession(id),
                onDelete: (id) => this.handleDeleteSession(id),
                onRename: (id, title) => this.handleRenameSession(id, title),
                onTogglePin: (id) => this.handleTogglePinSession(id),
                onDuplicate: (id) => this.handleDuplicateSession(id),
                onShare: (id) => this.handleShareSession(id),
                onExport: (id, format) => this.handleExportSession(id, format),
                onAddGroup: () => this.handleAddNewGroup(),
                onDeleteGroup: (id) => this.handleDeleteGroup(id),
                onRenameGroup: (id, title) => this.handleRenameGroup(id, title),
                onMoveSessionToGroup: (sessionId, groupId) =>
                    this.handleMoveSessionToGroup(sessionId, groupId),
                onToggleGroupExpansion: (id) => this.handleToggleGroupExpansion(id),
            },
            {
                isGenerating: this.app.isGenerating,
                generatingSessionId: this.app.generatingSessionId,
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
        const hasGeneratedImages =
            Array.isArray(message.generatedImages) && message.generatedImages.length > 0;
        const hasSources = Array.isArray(message.sources) && message.sources.length > 0;
        return (
            hasDisplayableText(message.text) ||
            hasDisplayableThoughts(message.thoughts) ||
            hasGeneratedImages ||
            hasSources
        );
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
            scroll: false,
        });
    }

    handleDeleteSession(sessionId) {
        const switchNeeded = this.sessionManager.deleteSession(sessionId);
        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'deleteSession',
            sessionId,
        });

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

    handleRenameSession(sessionId, title) {
        if (!this.sessionManager.updateSessionTitle(sessionId, title)) return;

        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'updateSessionMetadata',
            sessionId,
        });
        this.refreshHistoryUI();
    }

    handleTogglePinSession(sessionId) {
        if (!this.sessionManager.toggleSessionPinned(sessionId)) return;

        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'updateSessionMetadata',
            sessionId,
        });
        this.refreshHistoryUI();
    }

    handleDuplicateSession(sessionId) {
        const duplicated = this.sessionManager.duplicateSession(sessionId, (title) => {
            const template = t('duplicateChatTitle');
            return template.includes('{title}')
                ? template.replace('{title}', title)
                : `${title} copy`;
        });
        if (!duplicated) return;

        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'upsertSession',
            sessionId: duplicated.id,
        });
        this.refreshHistoryUI();
    }

    async handleShareSession(sessionId) {
        const session = this.sessionManager.getSessionById(sessionId);
        if (!session) return;

        try {
            await copyToClipboard(
                buildSessionTextExport(session, {
                    labels: this.getExportTextLabels(),
                    exportedAt: new Date().toISOString(),
                })
            );
            this.ui.updateStatus?.(t('shareChatCopied'));
            setTimeout(() => this.ui.updateStatus?.(''), 2000);
        } catch (error) {
            console.error('Failed to copy share text', error);
            this.ui.updateStatus?.(t('shareChatFailed'));
            setTimeout(() => this.ui.updateStatus?.(''), 3000);
        }
    }

    handleExportSession(sessionId, format) {
        const session = this.sessionManager.getSessionById(sessionId);
        if (!session) return;

        const exportFormat = format === 'json' ? 'json' : 'txt';
        const exportDate = new Date();
        const filename = buildSessionExportFilename(session, exportFormat, exportDate);
        if (exportFormat === 'json') {
            downloadTextFile(
                JSON.stringify(
                    serializeSessionForExport(session, exportDate.toISOString()),
                    null,
                    2
                ),
                filename,
                'application/json'
            );
            return;
        }

        downloadTextFile(
            buildSessionTextExport(session, {
                labels: this.getExportTextLabels(),
                exportedAt: exportDate.toISOString(),
            }),
            filename,
            'text/plain'
        );
    }

    getExportTextLabels() {
        return {
            userRole: t('exportRoleUser'),
            assistantRole: t('exportRoleAssistant'),
            title: t('exportTitle'),
            exportedAt: t('exportedAt'),
            messages: t('exportMessages'),
            attachments: t('exportAttachments'),
            generatedImages: t('exportGeneratedImages'),
            sources: t('exportSources'),
            thoughts: t('exportThoughts'),
        };
    }

    handleAddNewGroup() {
        this.sessionManager.createGroup(t('newGroupTitle'));
        saveGroupsToStorage(this.sessionManager.getPersistableGroups());
        this.refreshHistoryUI();
    }

    handleDeleteGroup(groupId) {
        if (!this.sessionManager.deleteGroup(groupId)) return;

        saveGroupsToStorage(this.sessionManager.getPersistableGroups());
        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'updateSessionGroups',
        });
        this.refreshHistoryUI();
    }

    handleRenameGroup(groupId, title) {
        if (!this.sessionManager.updateGroupTitle(groupId, title)) return;

        saveGroupsToStorage(this.sessionManager.getPersistableGroups());
        this.refreshHistoryUI();
    }

    handleMoveSessionToGroup(sessionId, groupId) {
        if (!this.sessionManager.moveSessionToGroup(sessionId, groupId)) return;

        saveSessionsToStorage(this.sessionManager.getPersistableSessions(), {
            type: 'updateSessionGroups',
        });
        this.refreshHistoryUI();
    }

    handleToggleGroupExpansion(groupId) {
        if (!this.sessionManager.toggleGroupExpansion(groupId)) return;

        saveGroupsToStorage(this.sessionManager.getPersistableGroups());
        this.refreshHistoryUI();
    }
}
