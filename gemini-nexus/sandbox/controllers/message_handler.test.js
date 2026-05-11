// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../core/session_manager.js';
import { MessageHandler } from './message_handler.js';
import { appendMessage } from '../render/message.js';

vi.mock('../render/message.js', () => ({
    appendContextCompressionNotice: vi.fn(),
    appendMessage: vi.fn(() => ({
        addImages: vi.fn(),
        addSources: vi.fn(),
        finalize: vi.fn(),
        update: vi.fn()
    }))
}));

vi.mock('../../lib/crop_utils.js', () => ({
    cropImage: vi.fn()
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

vi.mock('../../lib/watermark_remover.js', () => ({
    WatermarkRemover: vi.fn()
}));

function createMessageHandlerHarness() {
    const sessionManager = new SessionManager();
    sessionManager.setSessions([
        {
            id: 'session-1',
            title: 'Hello',
            timestamp: 100,
            messages: [
                { role: 'user', text: 'Hello' },
                { role: 'ai', text: 'Persisted reply' }
            ]
        }
    ]);
    sessionManager.setCurrentId('session-1');

    const ui = {
        getChatScrollState: vi.fn(() => ({ isNearBottom: true })),
        historyDiv: document.createElement('div'),
        followStreamingContent: vi.fn(),
        scrollToBottom: vi.fn(),
        setLoading: vi.fn()
    };

    const app = {
        isGenerating: true,
        generatingSessionId: 'session-1',
        prompt: {
            isCancellationRecent: vi.fn(() => false)
        },
        sessionFlow: {
            refreshHistoryUI: vi.fn()
        }
    };

    const handler = new MessageHandler(sessionManager, ui, {}, app);
    return { app, handler, sessionManager, ui };
}

describe('MessageHandler.handleGeminiReply', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a final reply even if storage already persisted that reply', () => {
        const { app, handler, sessionManager, ui } = createMessageHandlerHarness();

        handler.handleGeminiReply({
            action: 'GEMINI_REPLY',
            sessionId: 'session-1',
            status: 'success',
            text: 'Persisted reply',
            thoughts: 'Done thinking',
            thoughtsDurationSeconds: 2,
            context: ['conversation', 'response', 'choice']
        });

        expect(ui.setLoading).toHaveBeenCalledWith(false);
        expect(app.sessionFlow.refreshHistoryUI).toHaveBeenCalled();
        expect(sessionManager.getCurrentSession().context).toEqual(['conversation', 'response', 'choice']);
        expect(appendMessage).toHaveBeenCalledWith(
            ui.historyDiv,
            'Persisted reply',
            'ai',
            undefined,
            'Done thinking',
            undefined,
            {
                isFinal: true,
                thoughtsDurationSeconds: 2
            }
        );
    });

    it('does not append a duplicate final reply after storage already rendered it', () => {
        const { handler, sessionManager } = createMessageHandlerHarness();
        sessionManager.getCurrentSession().messages[1].thoughts = 'Done thinking';
        handler.markSessionRenderedFromStorage('session-1', 2);

        handler.handleGeminiReply({
            action: 'GEMINI_REPLY',
            sessionId: 'session-1',
            status: 'success',
            text: 'Persisted reply',
            thoughts: 'Done thinking',
            thoughtsDurationSeconds: 2,
            context: ['conversation', 'response', 'choice']
        });

        expect(sessionManager.getCurrentSession().context).toEqual(['conversation', 'response', 'choice']);
        expect(appendMessage).not.toHaveBeenCalled();
    });

    it('ignores replies for non-generating sessions', () => {
        const { handler } = createMessageHandlerHarness();

        handler.handleGeminiReply({
            action: 'GEMINI_REPLY',
            sessionId: 'other-session',
            status: 'success',
            text: 'Wrong reply'
        });

        expect(appendMessage).not.toHaveBeenCalled();
    });
});

describe('MessageHandler.handleStreamUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps consumed tool call JSON out of the assistant markdown stream', () => {
        const { handler } = createMessageHandlerHarness();
        const streamedText = `{
  "tool": "fill",
  "args": {
    "uid": "1_43",
    "value": "168168\\n518518"
  }
}
\`\`\`\`\`\`json
{
  "tool": "click",
  "args": {
    "uid": "1_44"
  }
}
\`\`\`\`\`\`json
{
  "tool": "take_snapshot",
  "args": {}
}
\`\`\`对于六位纯数字的 .xyz 域名，价格通常很便宜。`;

        handler.handleStreamUpdate({
            action: 'GEMINI_STREAM_UPDATE',
            sessionId: 'session-1',
            text: streamedText
        });

        const controller = appendMessage.mock.results[0].value;
        expect(controller.update).toHaveBeenLastCalledWith(
            '对于六位纯数字的 .xyz 域名，价格通常很便宜。',
            undefined,
            { isStreaming: true }
        );
    });

    it('does not flash a JSON code block for early streaming tool-call prefixes', () => {
        const { handler } = createMessageHandlerHarness();

        handler.handleStreamUpdate({
            action: 'GEMINI_STREAM_UPDATE',
            sessionId: 'session-1',
            text: '```json\n{'
        });

        const controller = appendMessage.mock.results[0].value;
        expect(controller.update).toHaveBeenLastCalledWith(
            '',
            undefined,
            { isStreaming: true }
        );
    });

    it('finalizes intermediate tool-call text without a copy button', () => {
        const { handler } = createMessageHandlerHarness();

        handler.handleStreamUpdate({
            action: 'GEMINI_STREAM_UPDATE',
            sessionId: 'session-1',
            text: '好的，我先检查一下配置状态。\n```json\n{"tool":"get_config_info","args":{}}',
            thoughts: '需要先调用配置工具。'
        });

        const controller = appendMessage.mock.results[0].value;
        handler.handleToolCallStatusMessage({
            action: 'TOOL_CALL_STATUS_MESSAGE',
            sessionId: 'session-1',
            toolName: 'get_config_info',
            status: 'running',
            toolCallText: '{"tool":"get_config_info","args":{}}'
        });

        expect(controller.finalize).toHaveBeenCalledWith(
            '好的，我先检查一下配置状态。',
            undefined,
            { suppressCopy: true }
        );
    });
});
