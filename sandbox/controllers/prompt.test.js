// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { PromptController } from './prompt.js';
import { appendMessage } from '../render/message.js';
import { saveSessionsToStorage, sendToBackground } from '../../shared/messaging/index.js';

vi.mock('../render/message.js', () => ({
    appendMessage: vi.fn(),
}));

vi.mock('../../shared/messaging/index.js', () => ({
    saveSessionsToStorage: vi.fn(),
    sendToBackground: vi.fn(),
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key,
}));

function createPromptHarness({ text = 'Hello', files = [] } = {}) {
    const sessionManager = new SessionManager();
    sessionManager.enterDraft();

    const ui = {
        historyDiv: document.createElement('div'),
        inputFn: { value: text },
        settings: { connectionData: { provider: 'official' } },
        resetInput: vi.fn(),
        setLoading: vi.fn(),
    };

    const imageManager = {
        getFiles: vi.fn(() => files),
        clearFile: vi.fn(),
    };

    const app = {
        pageContextActive: false,
        browserControlActive: false,
        isGenerating: false,
        generatingSessionId: null,
        getSelectedModel: vi.fn(() => 'gemini-test'),
        sessionFlow: {
            refreshHistoryUI: vi.fn(),
            switchToSession: vi.fn(),
        },
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
        expect(saveSessionsToStorage).toHaveBeenCalledWith([session], {
            type: 'upsertSession',
            sessionId: session.id,
        });
        expect(app.sessionFlow.switchToSession).toHaveBeenCalledWith(session.id);
        expect(app.isGenerating).toBe(true);
        expect(app.generatingSessionId).toBe(session.id);
        expect(sendToBackground).toHaveBeenLastCalledWith(
            expect.objectContaining({
                action: 'SEND_PROMPT',
                text: 'Hello',
                sessionId: session.id,
            })
        );
    });

    it('does not create a session for an empty draft send', async () => {
        const { controller, sessionManager } = createPromptHarness({ text: '   ' });

        await controller.send();

        expect(sessionManager.sessions).toEqual([]);
        expect(saveSessionsToStorage).not.toHaveBeenCalled();
        expect(sendToBackground).not.toHaveBeenCalled();
    });

    it('renders and persists full metadata for mixed user attachments', async () => {
        const files = [
            {
                base64: 'data:image/png;base64,AAAA',
                type: 'image/png',
                name: 'diagram.png',
            },
            {
                base64: 'data:application/pdf;base64,BBBB',
                type: 'application/pdf',
                name: 'spec.pdf',
            },
        ];
        const { controller, sessionManager, ui } = createPromptHarness({
            text: 'Review these',
            files,
        });

        await controller.send();

        const session = sessionManager.getCurrentSession();
        expect(appendMessage).toHaveBeenCalledWith(
            ui.historyDiv,
            'Review these',
            'user',
            files,
            null,
            null,
            expect.objectContaining({ onEdit: expect.any(Function) })
        );
        expect(session.messages[0]).toEqual({
            role: 'user',
            text: 'Review these',
            image: ['data:image/png;base64,AAAA'],
            attachments: files,
        });
        expect(sendToBackground).toHaveBeenLastCalledWith(
            expect.objectContaining({
                action: 'SEND_PROMPT',
                files,
            })
        );
    });

    it('includes the current Gemini Web thinking level in prompt requests', () => {
        const { controller, ui } = createPromptHarness();
        ui.settings.connectionData = {
            provider: 'web',
            webThinkingLevel: 'minimal',
        };

        expect(controller.buildRequestPayload('Hello', [], 'session-1')).toEqual(
            expect.objectContaining({
                webThinkingLevel: 'minimal',
            })
        );
    });
});
