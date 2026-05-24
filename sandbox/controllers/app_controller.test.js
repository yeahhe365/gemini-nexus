// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { AppController } from './app_controller.js';
import { saveSessionsToStorage } from '../../shared/messaging/index.js';

vi.mock('../render/message.js', () => ({
    appendMessage: vi.fn(),
}));

vi.mock('../render/context_compression.js', () => ({
    appendContextCompressionNotice: vi.fn(),
}));

vi.mock('../../shared/dom/crop_image.js', () => ({
    cropImage: vi.fn(),
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

vi.mock('../../shared/media/watermark_remover.js', () => ({
    WatermarkRemover: vi.fn(),
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
            updateSidePanelScope: vi.fn(),
        },
        toggleTabSwitcher: vi.fn(),
        updateBrowserControlState: vi.fn(),
        updateWebThinkingToggle: vi.fn(),
        setBrowserControlCallbacks: vi.fn(),
        updateModelList: vi.fn(),
        updateStatus: vi.fn(),
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
            payload,
        },
    };
}

function realSession(overrides = {}) {
    return {
        id: 'real',
        title: 'Real chat',
        timestamp: 100,
        messages: [{ role: 'user', text: 'Hello' }],
        context: null,
        ...overrides,
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
        expect(window.parent.postMessage).toHaveBeenCalledWith(
            {
                action: 'SAVE_SIDE_PANEL_SESSION_BINDING',
                payload: {
                    tabId: 123,
                    sessionId: 'real',
                },
            },
            '*'
        );
        expect(ui.clearChatHistory).toHaveBeenCalled();
    });

    it('falls back to draft when a remembered-tab binding points to a removed blank session', async () => {
        const { app, sessionManager, ui } = createAppHarness();
        app.currentTabId = 123;
        app.boundSessionId = 'blank';
        app.sidePanelScope = 'remembered_tabs';

        await app.handleIncomingMessage(
            restoreEvent([
                {
                    id: 'blank',
                    title: 'New Chat',
                    timestamp: 200,
                    messages: [],
                },
                realSession(),
            ])
        );

        expect(sessionManager.currentSessionId).toBeNull();
        expect(sessionManager.sessions).toEqual([expect.objectContaining({ id: 'real' })]);
        expect(saveSessionsToStorage).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'real' })],
            { type: 'pruneSessions' }
        );
        expect(window.parent.postMessage).toHaveBeenCalledWith(
            {
                action: 'SAVE_SIDE_PANEL_SESSION_BINDING',
                payload: {
                    tabId: 123,
                    sessionId: null,
                },
            },
            '*'
        );
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
                    sessionId: 'real',
                },
            },
        });

        expect(app.currentTabId).toBe(123);
        expect(sessionManager.currentSessionId).toBe('real');
    });

    it('restores saved groups and rerenders history after sessions are loaded', async () => {
        const { app, sessionManager, ui } = createAppHarness();

        await app.handleIncomingMessage(restoreEvent([realSession()]));
        ui.renderHistoryList.mockClear();

        await app.handleIncomingMessage({
            data: {
                action: 'RESTORE_GROUPS',
                payload: [{ id: 'group-1', title: 'Work', timestamp: 1, isExpanded: false }],
            },
        });

        expect(sessionManager.groups).toEqual([
            { id: 'group-1', title: 'Work', timestamp: 1, isExpanded: false },
        ]);
        expect(ui.renderHistoryList).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'real' })],
            [expect.objectContaining({ id: 'group-1' })],
            sessionManager.currentSessionId,
            expect.objectContaining({ onAddGroup: expect.any(Function) }),
            { isGenerating: false, generatingSessionId: null }
        );
    });

    it('rerenders the current chat when storage updates add an AI reply', async () => {
        const { app, sessionManager, ui } = createAppHarness();
        const markRendered = vi.spyOn(app.messageHandler, 'markSessionRenderedFromStorage');
        app.sidePanelScope = 'remembered_tabs';
        sessionManager.setSessions([realSession()]);
        sessionManager.setCurrentId('real');

        await app.handleIncomingMessage(
            restoreEvent([
                realSession({
                    messages: [
                        { role: 'user', text: 'Hello' },
                        { role: 'ai', text: 'Hi there' },
                    ],
                }),
            ])
        );

        expect(sessionManager.currentSessionId).toBe('real');
        expect(ui.clearChatHistory).toHaveBeenCalled();
        expect(ui.getChatScrollState).toHaveBeenCalled();
        expect(ui.restoreChatScrollState).toHaveBeenCalledWith({
            scrollTop: 120,
            isNearBottom: false,
        });
        expect(ui.scrollToBottom).not.toHaveBeenCalled();
        expect(markRendered).toHaveBeenCalledWith('real', 2);
    });

    it('saves model changes with the active provider so OpenAI selection can persist separately', () => {
        const { app, ui } = createAppHarness();
        ui.settings.connectionData.provider = 'openai';

        app.handleModelChange('gpt-5');

        expect(window.parent.postMessage).toHaveBeenCalledWith(
            {
                action: 'SAVE_MODEL',
                payload: {
                    provider: 'openai',
                    model: 'gpt-5',
                },
            },
            '*'
        );
    });

    it('toggles Gemini Web thinking between high and the model fast level', () => {
        const { app, ui } = createAppHarness();
        ui.modelSelect.value = '8c46e95b1a07cecc';
        ui.settings.connectionData = { provider: 'web', webThinkingLevel: 'high' };

        app.handleWebThinkingToggle();

        expect(ui.settings.connectionData.webThinkingLevel).toBe('minimal');
        expect(ui.updateWebThinkingToggle).toHaveBeenCalledWith(ui.settings.connectionData);
        expect(window.parent.postMessage).toHaveBeenCalledWith(
            {
                action: 'SAVE_WEB_THINKING_LEVEL',
                payload: 'minimal',
            },
            '*'
        );

        app.handleWebThinkingToggle();

        expect(ui.settings.connectionData.webThinkingLevel).toBe('high');
        expect(window.parent.postMessage).toHaveBeenCalledWith(
            {
                action: 'SAVE_WEB_THINKING_LEVEL',
                payload: 'high',
            },
            '*'
        );
    });

    it('does not toggle Web thinking for non-Web providers', () => {
        const { app, ui } = createAppHarness();
        ui.settings.connectionData = { provider: 'official', webThinkingLevel: 'high' };

        app.handleWebThinkingToggle();

        expect(window.parent.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SAVE_WEB_THINKING_LEVEL' }),
            '*'
        );
        expect(ui.updateWebThinkingToggle).toHaveBeenCalledWith(ui.settings.connectionData);
    });

    it('forwards locked tab updates to the browser control bar state', async () => {
        const { app, ui } = createAppHarness();

        await app.handleIncomingMessage({
            data: {
                action: 'BACKGROUND_MESSAGE',
                payload: {
                    action: 'TAB_LOCKED',
                    attached: true,
                    tab: {
                        id: 7,
                        title: 'OpenAI News',
                        url: 'https://openai.com/news/',
                        controllable: true,
                    },
                },
            },
        });

        expect(ui.updateBrowserControlState).toHaveBeenCalledWith({
            attached: true,
            tab: {
                id: 7,
                title: 'OpenAI News',
                url: 'https://openai.com/news/',
                controllable: true,
            },
        });
    });

    it('ignores malformed incoming window messages', async () => {
        const { app, ui } = createAppHarness();

        await app.handleIncomingMessage({ data: null });
        await app.handleIncomingMessage({
            data: {
                action: 'BACKGROUND_MESSAGE',
                payload: null,
            },
        });

        expect(ui.updateBrowserControlState).not.toHaveBeenCalled();
        expect(ui.updateStatus).not.toHaveBeenCalled();
    });
});
