// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { PromptController } from './prompt.js';
import { appendMessage } from '../render/message.js';
import { saveSessionsToStorage, sendToBackground } from '../../lib/messaging.js';

vi.mock('../render/message.js', () => ({
    appendMessage: vi.fn()
}));

vi.mock('../../lib/messaging.js', () => ({
    saveSessionsToStorage: vi.fn(),
    sendToBackground: vi.fn()
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

function createPromptHarness({ text = 'Hello', files = [] } = {}) {
    const sessionManager = new SessionManager();
    sessionManager.enterDraft();

    const ui = {
        historyDiv: document.createElement('div'),
        inputFn: { value: text },
        settings: { connectionData: { provider: 'official' } },
        resetInput: vi.fn(),
        setLoading: vi.fn()
    };

    const imageManager = {
        getFiles: vi.fn(() => files),
        clearFile: vi.fn()
    };

    const app = {
        pageContextActive: false,
        browserControlActive: false,
        isGenerating: false,
        generatingSessionId: null,
        getSelectedModel: vi.fn(() => 'gemini-test'),
        sessionFlow: {
            refreshHistoryUI: vi.fn(),
            switchToSession: vi.fn()
        }
    };

    const controller = new PromptController(sessionManager, ui, imageManager, app);
    return { app, controller, imageManager, sessionManager, ui };
}

describe('PromptController.send', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates and enters a persisted session when sending from draft state', async () => {
        const { app, controller, sessionManager, ui } = createPromptHarness();

        await controller.send();

        const session = sessionManager.getCurrentSession();
        expect(session).toBeTruthy();
        expect(session.title).toBe('Hello');
        expect(session.messages).toEqual([{ role: 'user', text: 'Hello' }]);

        expect(appendMessage).toHaveBeenCalledWith(
            ui.historyDiv,
            'Hello',
            'user',
            null,
            null,
            null,
            expect.objectContaining({ onEdit: expect.any(Function) })
        );
        expect(saveSessionsToStorage).toHaveBeenCalledWith([session]);
        expect(app.sessionFlow.switchToSession).toHaveBeenCalledWith(session.id);
        expect(app.isGenerating).toBe(true);
        expect(app.generatingSessionId).toBe(session.id);
        expect(sendToBackground).toHaveBeenLastCalledWith(expect.objectContaining({
            action: 'SEND_PROMPT',
            text: 'Hello',
            sessionId: session.id
        }));
    });

    it('does not create a session for an empty draft send', async () => {
        const { controller, sessionManager } = createPromptHarness({ text: '   ' });

        await controller.send();

        expect(sessionManager.sessions).toEqual([]);
        expect(saveSessionsToStorage).not.toHaveBeenCalled();
        expect(sendToBackground).not.toHaveBeenCalled();
    });
});
