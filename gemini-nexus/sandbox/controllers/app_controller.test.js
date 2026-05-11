// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { AppController } from './app_controller.js';
import { saveSessionsToStorage } from '../../lib/messaging.js';

vi.mock('../render/message.js', () => ({
    appendContextCompressionNotice: vi.fn(),
    appendMessage: vi.fn()
}));

vi.mock('../../lib/crop_utils.js', () => ({
    cropImage: vi.fn()
}));

vi.mock('../../lib/messaging.js', () => ({
    saveSessionsToStorage: vi.fn(),
    sendToBackground: vi.fn()
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

vi.mock('../../lib/watermark_remover.js', () => ({
    WatermarkRemover: vi.fn()
}));

function createUi() {
    return {
        chat: { togglePageContext: vi.fn() },
        clearChatHistory: vi.fn(),
        historyDiv: document.createElement('div'),
        inputFn: { focus: vi.fn(), value: '' },
        modelSelect: { value: 'gemini-test' },
        renderHistoryList: vi.fn(),
        resetInput: vi.fn(),
        getChatScrollState: vi.fn(() => ({ scrollTop: 120, isNearBottom: false })),
        restoreChatScrollState: vi.fn(),
        scrollToBottom: vi.fn(),
        settings: {
            connectionData: { provider: 'web' },
            updateContextSettings: vi.fn(),
            updateConnectionSettings: vi.fn(),
            updateSidebarBehavior: vi.fn(),
            updateSidePanelScope: vi.fn()
        },
        toggleTabSwitcher: vi.fn(),
        updateModelList: vi.fn(),
        updateStatus: vi.fn()
    };
}

function createAppHarness() {
    const sessionManager = new SessionManager();
    const ui = createUi();
    const imageManager = {};
    const app = new AppController(sessionManager, ui, imageManager);
    return { app, sessionManager, ui };
}

function restoreEvent(payload) {
    return {
        data: {
            action: 'RESTORE_SESSIONS',
            payload
        }
    };
}

function realSession(overrides = {}) {
    return {
        id: 'real',
        title: 'Real chat',
        timestamp: 100,
        messages: [{ role: 'user', text: 'Hello' }],
        context: null,
        ...overrides
    };
}

describe('AppController session restore behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    });

    it('restores a valid remembered-tab bound session', async () => {
        const { app, sessionManager, ui } = createAppHarness();
        app.currentTabId = 123;
        app.boundSessionId = 'real';
        app.sidePanelScope = 'remembered_tabs';

        await app.handleIncomingMessage(restoreEvent([realSession()]));

        expect(sessionManager.currentSessionId).toBe('real');
        expect(app.boundSessionId).toBe('real');
        expect(window.parent.postMessage).toHaveBeenCalledWith({
            action: 'SAVE_SIDE_PANEL_SESSION_BINDING',
            payload: {
                tabId: 123,
                sessionId: 'real'
            }
        }, '*');
        expect(ui.clearChatHistory).toHaveBeenCalled();
    });

    it('falls back to draft when a remembered-tab binding points to a removed blank session', async () => {
        const { app, sessionManager, ui } = createAppHarness();
        app.currentTabId = 123;
        app.boundSessionId = 'blank';
        app.sidePanelScope = 'remembered_tabs';

        await app.handleIncomingMessage(restoreEvent([
            {
                id: 'blank',
                title: 'New Chat',
                timestamp: 200,
                messages: []
            },
            realSession()
        ]));

        expect(sessionManager.currentSessionId).toBeNull();
        expect(sessionManager.sessions).toEqual([expect.objectContaining({ id: 'real' })]);
        expect(saveSessionsToStorage).toHaveBeenCalledWith([expect.objectContaining({ id: 'real' })]);
        expect(window.parent.postMessage).toHaveBeenCalledWith({
            action: 'SAVE_SIDE_PANEL_SESSION_BINDING',
            payload: {
                tabId: 123,
                sessionId: null
            }
        }, '*');
        expect(ui.clearChatHistory).toHaveBeenCalled();
    });

    it('restores the active tab binding after sessions are already loaded', async () => {
        const { app, sessionManager } = createAppHarness();
        app.sidePanelScope = 'remembered_tabs';

        await app.handleIncomingMessage(restoreEvent([realSession()]));
        expect(sessionManager.currentSessionId).toBeNull();

        await app.handleIncomingMessage({
            data: {
                action: 'RESTORE_SIDE_PANEL_TAB_CONTEXT',
                payload: {
                    tabId: 123,
                    sessionId: 'real'
                }
            }
        });

        expect(app.currentTabId).toBe(123);
        expect(sessionManager.currentSessionId).toBe('real');
    });

    it('rerenders the current chat when storage updates add an AI reply', async () => {
        const { app, sessionManager, ui } = createAppHarness();
        const markRendered = vi.spyOn(app.messageHandler, 'markSessionRenderedFromStorage');
        app.sidePanelScope = 'remembered_tabs';
        sessionManager.setSessions([realSession()]);
        sessionManager.setCurrentId('real');

        await app.handleIncomingMessage(restoreEvent([
            realSession({
                messages: [
                    { role: 'user', text: 'Hello' },
                    { role: 'ai', text: 'Hi there' }
                ]
            })
        ]));

        expect(sessionManager.currentSessionId).toBe('real');
        expect(ui.clearChatHistory).toHaveBeenCalled();
        expect(ui.getChatScrollState).toHaveBeenCalled();
        expect(ui.restoreChatScrollState).toHaveBeenCalledWith({ scrollTop: 120, isNearBottom: false });
        expect(ui.scrollToBottom).not.toHaveBeenCalled();
        expect(markRendered).toHaveBeenCalledWith('real', 2);
    });

    it('saves model changes with the active provider so OpenAI selection can persist separately', () => {
        const { app, ui } = createAppHarness();
        ui.settings.connectionData.provider = 'openai';

        app.handleModelChange('gpt-5');

        expect(window.parent.postMessage).toHaveBeenCalledWith({
            action: 'SAVE_MODEL',
            payload: {
                provider: 'openai',
                model: 'gpt-5'
            }
        }, '*');
    });
});
