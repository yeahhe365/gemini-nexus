// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { SessionFlowController } from './session_flow.js';
import { appendMessage } from '../render/message.js';
import { copyToClipboard } from '../render/clipboard.js';
import {
    downloadTextFile,
    saveGroupsToStorage,
    saveSessionsToStorage,
    sendToBackground,
} from '../../shared/messaging/index.js';

vi.mock('../render/message.js', () => ({
    appendMessage: vi.fn(),
}));

vi.mock('../render/context_compression.js', () => ({
    appendContextCompressionNotice: vi.fn(),
}));

vi.mock('../render/clipboard.js', () => ({
    copyToClipboard: vi.fn(),
}));

vi.mock('../../shared/messaging/index.js', () => ({
    downloadTextFile: vi.fn(),
    saveGroupsToStorage: vi.fn(),
    saveSessionsToStorage: vi.fn(),
    sendToBackground: vi.fn(),
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key,
}));

function createSessionFlowHarness() {
    const sessionManager = new SessionManager();
    const ui = {
        clearChatHistory: vi.fn(),
        historyDiv: document.createElement('div'),
        renderHistoryList: vi.fn(),
        resetInput: vi.fn(),
        scrollToBottom: vi.fn(),
        updateStatus: vi.fn(),
    };
    const app = {
        boundSessionId: null,
        generatingSessionId: null,
        isGenerating: false,
        getSelectedModel: vi.fn(() => 'gemini-test'),
        messageHandler: {
            resetStream: vi.fn(),
            restoreStreamForSession: vi.fn(),
        },
        prompt: {
            getMessageEditOptions: vi.fn(() => ({ onEdit: vi.fn() })),
        },
        saveCurrentTabSessionBinding: vi.fn(),
    };

    const controller = new SessionFlowController(sessionManager, ui, app);
    return { app, controller, sessionManager, ui };
}

function realSession(overrides = {}) {
    return {
        id: 'session-1',
        title: 'Hello',
        timestamp: 100,
        messages: [{ role: 'user', text: 'Hello' }],
        context: null,
        ...overrides,
    };
}

describe('SessionFlowController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enters draft without persisting or binding a blank session', () => {
        const { app, controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([realSession()]);
        sessionManager.setCurrentId('session-1');

        controller.handleNewChat();

        expect(sessionManager.currentSessionId).toBeNull();
        expect(app.boundSessionId).toBeNull();
        expect(app.saveCurrentTabSessionBinding).toHaveBeenCalledWith(null);
        expect(sendToBackground).toHaveBeenCalledWith({ action: 'RESET_CONTEXT' });
        expect(ui.clearChatHistory).toHaveBeenCalled();
        expect(ui.resetInput).toHaveBeenCalled();
        expect(ui.renderHistoryList).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'session-1' })],
            [],
            null,
            expect.objectContaining({
                onSwitch: expect.any(Function),
                onDelete: expect.any(Function),
            }),
            { isGenerating: false, generatingSessionId: null }
        );
    });

    it('switches to a persisted session, renders messages, and saves the tab binding', () => {
        const { app, controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([
            realSession({
                context: ['conversation', 'response', 'choice'],
                messages: [
                    { role: 'user', text: 'Hello' },
                    { role: 'ai', text: 'Hi there', thoughts: 'thinking' },
                ],
            }),
        ]);

        controller.switchToSession('session-1');

        expect(sessionManager.currentSessionId).toBe('session-1');
        expect(ui.clearChatHistory).toHaveBeenCalled();
        expect(appendMessage).toHaveBeenCalledTimes(2);
        expect(appendMessage).toHaveBeenNthCalledWith(
            1,
            ui.historyDiv,
            'Hello',
            'user',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({ autoScroll: false })
        );
        expect(appendMessage).toHaveBeenNthCalledWith(
            2,
            ui.historyDiv,
            'Hi there',
            'ai',
            undefined,
            'thinking',
            undefined,
            expect.objectContaining({ autoScroll: false })
        );
        expect(app.boundSessionId).toBe('session-1');
        expect(app.saveCurrentTabSessionBinding).toHaveBeenCalledWith('session-1');
        expect(sendToBackground).toHaveBeenCalledWith({
            action: 'SET_CONTEXT',
            context: ['conversation', 'response', 'choice'],
            model: 'gemini-test',
        });
        expect(ui.scrollToBottom).toHaveBeenCalled();
        expect(ui.resetInput).toHaveBeenCalled();
    });

    it('passes suppressCopy when restoring intermediate AI tool-call messages', () => {
        const { controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([
            realSession({
                messages: [
                    { role: 'user', text: 'Hello' },
                    {
                        role: 'ai',
                        text: '我来检查一下配置状态。',
                        thoughts: '需要调用工具。',
                        suppressCopy: true,
                    },
                ],
            }),
        ]);

        controller.switchToSession('session-1');

        expect(appendMessage).toHaveBeenNthCalledWith(
            2,
            ui.historyDiv,
            '我来检查一下配置状态。',
            'ai',
            undefined,
            '需要调用工具。',
            undefined,
            expect.objectContaining({
                suppressCopy: true,
                autoScroll: false,
            })
        );
    });

    it('restores image-only AI messages from generated image history', () => {
        const { controller, sessionManager, ui } = createSessionFlowHarness();
        const generatedImages = [
            { url: 'https://lh3.googleusercontent.com/generated-1', alt: 'Generated Image' },
            { url: 'https://lh3.googleusercontent.com/generated-2', alt: 'Generated Image' },
        ];

        sessionManager.setSessions([
            realSession({
                messages: [
                    { role: 'user', text: '生成两张图' },
                    {
                        role: 'ai',
                        text: '',
                        generatedImages,
                    },
                ],
            }),
        ]);

        controller.switchToSession('session-1');

        expect(appendMessage).toHaveBeenCalledTimes(2);
        expect(appendMessage).toHaveBeenNthCalledWith(
            2,
            ui.historyDiv,
            '',
            'ai',
            generatedImages,
            undefined,
            undefined,
            expect.objectContaining({ autoScroll: false })
        );
    });

    it('restores full user attachment metadata when present', () => {
        const { controller, sessionManager, ui } = createSessionFlowHarness();
        const attachments = [
            {
                base64: 'data:application/pdf;base64,BBBB',
                type: 'application/pdf',
                name: 'spec.pdf',
            },
        ];

        sessionManager.setSessions([
            realSession({
                messages: [
                    {
                        role: 'user',
                        text: 'Review this file',
                        image: ['data:application/pdf;base64,BBBB'],
                        attachments,
                    },
                ],
            }),
        ]);

        controller.switchToSession('session-1');

        expect(appendMessage).toHaveBeenCalledWith(
            ui.historyDiv,
            'Review this file',
            'user',
            attachments,
            undefined,
            undefined,
            expect.objectContaining({ autoScroll: false })
        );
    });

    it('restores a supplied scroll state after rebuilding a session', () => {
        const { app, controller, sessionManager, ui } = createSessionFlowHarness();
        const scrollState = { scrollTop: 320, isNearBottom: false };
        ui.restoreChatScrollState = vi.fn();
        sessionManager.setSessions([realSession()]);

        controller.switchToSession('session-1', { restoreScrollState: scrollState });

        expect(ui.restoreChatScrollState).toHaveBeenCalledWith(scrollState);
        expect(ui.scrollToBottom).not.toHaveBeenCalled();
        expect(app.boundSessionId).toBe('session-1');
    });

    it('deleting the last current session saves empty history and returns to draft', () => {
        const { app, controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([realSession()]);
        sessionManager.setCurrentId('session-1');

        controller.handleDeleteSession('session-1');

        expect(saveSessionsToStorage).toHaveBeenCalledWith([], {
            type: 'deleteSession',
            sessionId: 'session-1',
        });
        expect(sessionManager.sessions).toEqual([]);
        expect(sessionManager.currentSessionId).toBeNull();
        expect(app.saveCurrentTabSessionBinding).toHaveBeenCalledWith(null);
        expect(sendToBackground).toHaveBeenCalledWith({ action: 'RESET_CONTEXT' });
        expect(ui.clearChatHistory).toHaveBeenCalled();
    });

    it('renames, pins, and duplicates sessions from sidebar actions', () => {
        const { controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([
            realSession({
                context: { sensitive: 'do-not-copy' },
                contextSummary: { sourceMessageCount: 1 },
            }),
        ]);

        controller.handleRenameSession('session-1', 'Research Notes');
        expect(sessionManager.getSessionById('session-1').title).toBe('Research Notes');
        expect(saveSessionsToStorage).toHaveBeenLastCalledWith(
            [expect.objectContaining({ id: 'session-1', title: 'Research Notes' })],
            { type: 'updateSessionMetadata', sessionId: 'session-1' }
        );

        controller.handleTogglePinSession('session-1');
        expect(sessionManager.getSessionById('session-1').isPinned).toBe(true);
        expect(saveSessionsToStorage).toHaveBeenLastCalledWith(
            [expect.objectContaining({ id: 'session-1', isPinned: true })],
            { type: 'updateSessionMetadata', sessionId: 'session-1' }
        );

        controller.handleDuplicateSession('session-1');
        const duplicate = sessionManager.sessions.find((session) => session.id !== 'session-1');
        expect(duplicate).toEqual(
            expect.objectContaining({
                title: 'Research Notes copy',
                context: null,
                isPinned: false,
            })
        );
        expect(duplicate.contextSummary).toBeUndefined();
        expect(duplicate.messages).toEqual(sessionManager.getSessionById('session-1').messages);
        expect(saveSessionsToStorage).toHaveBeenLastCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: duplicate.id })]),
            { type: 'upsertSession', sessionId: duplicate.id }
        );
        expect(ui.renderHistoryList).toHaveBeenCalled();
    });

    it('exports sessions as txt and json downloads', () => {
        const { controller, sessionManager } = createSessionFlowHarness();
        sessionManager.setSessions([
            realSession({
                title: 'Research/Notes',
                context: { sensitive: 'do-not-export' },
                messages: [
                    {
                        role: 'user',
                        text: 'Hello',
                        attachments: [{ name: 'brief.pdf', type: 'application/pdf' }],
                    },
                    {
                        role: 'ai',
                        text: 'Hi',
                        sources: [{ title: 'Example', url: 'https://example.com' }],
                    },
                ],
            }),
        ]);

        controller.handleExportSession('session-1', 'txt');
        expect(downloadTextFile).toHaveBeenLastCalledWith(
            expect.stringContaining('Title: Research/Notes'),
            expect.stringMatching(/^gemini-nexus-Research-Notes-\d{4}-\d{2}-\d{2}\.txt$/),
            'text/plain'
        );

        controller.handleExportSession('session-1', 'json');
        const [jsonText, filename, contentType] = downloadTextFile.mock.calls.at(-1);
        const exported = JSON.parse(jsonText);
        expect(filename).toMatch(/^gemini-nexus-Research-Notes-\d{4}-\d{2}-\d{2}\.json$/);
        expect(contentType).toBe('application/json');
        expect(exported).toEqual(
            expect.objectContaining({
                type: 'GeminiNexus-Chat',
                version: 1,
                session: expect.objectContaining({
                    id: 'session-1',
                    title: 'Research/Notes',
                    context: null,
                }),
            })
        );
    });

    it('copies a readable share transcript to the clipboard', async () => {
        copyToClipboard.mockResolvedValue(undefined);
        const { controller, sessionManager, ui } = createSessionFlowHarness();
        sessionManager.setSessions([
            realSession({
                title: 'Research Notes',
                messages: [
                    { role: 'user', text: 'Hello' },
                    {
                        role: 'ai',
                        text: 'Hi',
                        sources: [{ title: 'Docs', url: 'https://example.com' }],
                    },
                ],
            }),
        ]);

        await controller.handleShareSession('session-1');

        expect(copyToClipboard).toHaveBeenCalledWith(
            expect.stringContaining('Title: Research Notes')
        );
        expect(copyToClipboard).toHaveBeenCalledWith(
            expect.stringContaining('Docs: https://example.com')
        );
        expect(ui.updateStatus).toHaveBeenCalledWith('shareChatCopied');
    });

    it('creates groups and persists them separately from sessions', () => {
        const { controller, sessionManager, ui } = createSessionFlowHarness();

        controller.handleAddNewGroup();

        expect(sessionManager.groups).toHaveLength(1);
        expect(saveGroupsToStorage).toHaveBeenCalledWith([
            expect.objectContaining({ title: 'newGroupTitle', isExpanded: true }),
        ]);
        expect(ui.renderHistoryList).toHaveBeenLastCalledWith(
            [],
            [expect.objectContaining({ title: 'newGroupTitle' })],
            null,
            expect.objectContaining({
                onDeleteGroup: expect.any(Function),
                onMoveSessionToGroup: expect.any(Function),
            }),
            { isGenerating: false, generatingSessionId: null }
        );
    });

    it('moves sessions into groups and removes assignments when deleting the group', () => {
        const { controller, sessionManager } = createSessionFlowHarness();
        sessionManager.setSessions([realSession()]);
        const group = sessionManager.createGroup('Work');

        controller.handleMoveSessionToGroup('session-1', group.id);

        expect(sessionManager.getSessionById('session-1').groupId).toBe(group.id);
        expect(saveSessionsToStorage).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'session-1', groupId: group.id })],
            { type: 'updateSessionGroups' }
        );

        controller.handleDeleteGroup(group.id);

        expect(saveGroupsToStorage).toHaveBeenLastCalledWith([]);
        expect(sessionManager.getSessionById('session-1').groupId).toBeNull();
        expect(saveSessionsToStorage).toHaveBeenLastCalledWith(
            [expect.objectContaining({ id: 'session-1', groupId: null })],
            { type: 'updateSessionGroups' }
        );
    });
});
