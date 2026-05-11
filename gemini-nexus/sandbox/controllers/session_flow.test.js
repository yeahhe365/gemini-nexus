// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { SessionFlowController } from './session_flow.js';
import { appendMessage } from '../render/message.js';
import { saveSessionsToStorage, sendToBackground } from '../../lib/messaging.js';

vi.mock('../render/message.js', () => ({
    appendContextCompressionNotice: vi.fn(),
    appendMessage: vi.fn()
}));

vi.mock('../../lib/messaging.js', () => ({
    saveSessionsToStorage: vi.fn(),
    sendToBackground: vi.fn()
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

function createSessionFlowHarness() {
    const sessionManager = new SessionManager();
    const ui = {
        clearChatHistory: vi.fn(),
        historyDiv: document.createElement('div'),
        renderHistoryList: vi.fn(),
        resetInput: vi.fn(),
        scrollToBottom: vi.fn()
    };
    const app = {
        boundSessionId: null,
        generatingSessionId: null,
        isGenerating: false,
        getSelectedModel: vi.fn(() => 'gemini-test'),
        messageHandler: {
            resetStream: vi.fn(),
            restoreStreamForSession: vi.fn()
        },
        prompt: {
            getMessageEditOptions: vi.fn(() => ({ onEdit: vi.fn() }))
        },
        saveCurrentTabSessionBinding: vi.fn()
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
        ...overrides
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
            null,
            expect.objectContaining({ onSwitch: expect.any(Function), onDelete: expect.any(Function) }),
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
                    { role: 'ai', text: 'Hi there', thoughts: 'thinking' }
                ]
            })
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
            model: 'gemini-test'
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
                        suppressCopy: true
                    }
                ]
            })
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
                autoScroll: false
            })
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

        expect(saveSessionsToStorage).toHaveBeenCalledWith([]);
        expect(sessionManager.sessions).toEqual([]);
        expect(sessionManager.currentSessionId).toBeNull();
        expect(app.saveCurrentTabSessionBinding).toHaveBeenCalledWith(null);
        expect(sendToBackground).toHaveBeenCalledWith({ action: 'RESET_CONTEXT' });
        expect(ui.clearChatHistory).toHaveBeenCalled();
    });
});
