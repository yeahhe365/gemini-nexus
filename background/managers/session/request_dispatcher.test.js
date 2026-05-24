import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOfficialMessage } from '../../../services/providers/official.js';
import { sendOpenAIMessage } from '../../../services/providers/openai_compatible.js';
import { sendWebMessage } from '../../../services/providers/web.js';
import { prepareManagedContext } from './context_manager.js';
import { getHistory } from './history_store.js';
import { RequestDispatcher } from './request_dispatcher.js';

vi.mock('../../../services/providers/official.js', () => ({
    sendOfficialMessage: vi.fn(),
}));

vi.mock('../../../services/providers/openai_compatible.js', () => ({
    sendOpenAIMessage: vi.fn(),
}));

vi.mock('../../../services/providers/web.js', () => ({
    sendWebMessage: vi.fn(),
}));

vi.mock('./history_store.js', () => ({
    getHistory: vi.fn(async () => []),
}));

vi.mock('./context_manager.js', () => ({
    prepareManagedContext: vi.fn(async () => ({
        history: [],
        systemInstruction: 'system',
    })),
}));

describe('RequestDispatcher response mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn(() => Promise.resolve()),
            },
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('preserves official provider response metadata in a Gemini reply', async () => {
        sendOfficialMessage.mockResolvedValue({
            text: 'official text',
            thoughts: 'official thoughts',
            sources: [{ url: 'https://example.test' }],
            images: ['image-a'],
            thoughtSignature: 'signature',
            officialContent: { role: 'model', parts: [] },
            functionCalls: [{ name: 'take_snapshot', args: {} }],
        });
        const dispatcher = new RequestDispatcher({});

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gemini-test', sessionId: 'session-1' },
                {
                    provider: 'official',
                    apiKey: 'key',
                    officialBaseUrl: 'https://api.example.test',
                    officialModel: 'gemini-test',
                },
                [],
                vi.fn(),
                null
            )
        ).resolves.toEqual({
            action: 'GEMINI_REPLY',
            sessionId: 'session-1',
            text: 'official text',
            thoughts: 'official thoughts',
            sources: [{ url: 'https://example.test' }],
            images: ['image-a'],
            status: 'success',
            context: null,
            thoughtSignature: 'signature',
            officialContent: { role: 'model', parts: [] },
            functionCalls: [{ name: 'take_snapshot', args: {} }],
        });
    });

    it('maps OpenAI provider responses into the common Gemini reply shape', async () => {
        sendOpenAIMessage.mockResolvedValue({
            text: 'openai text',
            thoughts: null,
            sources: [],
            images: [],
        });
        const dispatcher = new RequestDispatcher({});

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gpt-test', sessionId: null },
                {
                    provider: 'openai',
                    openaiBaseUrl: 'https://api.example.test',
                    openaiApiKey: 'key',
                    openaiModel: 'gpt-test',
                },
                [],
                vi.fn(),
                null
            )
        ).resolves.toEqual({
            action: 'GEMINI_REPLY',
            sessionId: null,
            text: 'openai text',
            thoughts: null,
            sources: [],
            images: [],
            status: 'success',
            context: null,
        });
        expect(prepareManagedContext).toHaveBeenCalled();
    });

    it('allows OpenAI Chat Completions web search for official search models', async () => {
        sendOpenAIMessage.mockResolvedValue({
            text: 'openai text',
            thoughts: null,
            sources: [],
            images: [],
        });
        const dispatcher = new RequestDispatcher({});

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gpt-5-search-api', sessionId: null },
                {
                    provider: 'openai',
                    openaiBaseUrl: 'https://api.openai.com/v1',
                    openaiApiKey: 'key',
                    openaiModel: 'gpt-5-search-api',
                    openaiUseResponsesApi: false,
                    openaiWebSearch: true,
                },
                [],
                vi.fn(),
                null
            )
        ).resolves.toEqual(expect.objectContaining({ status: 'success' }));
    });

    it('rejects OpenAI Chat Completions web search for non-search official models', async () => {
        const dispatcher = new RequestDispatcher({});

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gpt-5', sessionId: null },
                {
                    provider: 'openai',
                    openaiBaseUrl: 'https://api.openai.com/v1',
                    openaiApiKey: 'key',
                    openaiModel: 'gpt-5',
                    openaiUseResponsesApi: false,
                    openaiWebSearch: true,
                    openaiThinkingLevel: 'low',
                },
                [],
                vi.fn(),
                null
            )
        ).rejects.toThrow(/Chat Completions web search requires an OpenAI search model/);

        expect(sendOpenAIMessage).not.toHaveBeenCalled();
    });

    it('does not apply Chat Completions search-model restrictions to Responses API web search', async () => {
        sendOpenAIMessage.mockResolvedValue({
            text: 'openai text',
            thoughts: null,
            sources: [],
            images: [],
        });
        const dispatcher = new RequestDispatcher({});

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gpt-5', sessionId: null },
                {
                    provider: 'openai',
                    openaiBaseUrl: 'https://api.openai.com/v1',
                    openaiApiKey: 'key',
                    openaiModel: 'gpt-5',
                    openaiUseResponsesApi: true,
                    openaiWebSearch: true,
                    openaiThinkingLevel: 'low',
                },
                [],
                vi.fn(),
                null
            )
        ).resolves.toEqual(expect.objectContaining({ status: 'success' }));
    });

    it('maps web provider responses without persisting Web auth context into chat history', async () => {
        sendWebMessage.mockResolvedValue({
            text: 'web text',
            thoughts: 'web thoughts',
            images: ['image-b'],
            newContext: {
                atValue: 'at-token',
                uploadPushId: 'feeds/upload-dynamic',
                uploadClientPctx: 'client-pctx-token',
            },
        });
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ['old context']),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        await expect(
            dispatcher.dispatch(
                { text: 'hello', model: 'gemini-web', sessionId: 'session-web' },
                { provider: 'web' },
                [],
                vi.fn(),
                null
            )
        ).resolves.toEqual({
            action: 'GEMINI_REPLY',
            sessionId: 'session-web',
            text: 'web text',
            thoughts: 'web thoughts',
            sources: [],
            images: ['image-b'],
            status: 'success',
            context: null,
        });
    });

    it('drops Gemini Web image echoes when the current request includes image attachments', async () => {
        const echoedInputImage = { url: 'https://lh3.googleusercontent.com/uploaded-input' };
        sendWebMessage.mockResolvedValue({
            text: 'web text',
            thoughts: null,
            images: [echoedInputImage],
            newContext: { atValue: 'new-at-token' },
        });
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ({ atValue: 'at-token' })),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);
        const files = [
            {
                name: 'image.png',
                type: 'image/png',
                base64: 'data:image/png;base64,AAAA',
            },
        ];

        await expect(
            dispatcher.dispatch(
                { text: 'what is this?', model: 'gemini-web', sessionId: 'session-web' },
                { provider: 'web' },
                files,
                vi.fn(),
                null
            )
        ).resolves.toEqual({
            action: 'GEMINI_REPLY',
            sessionId: 'session-web',
            text: 'web text',
            thoughts: null,
            sources: [],
            images: [],
            status: 'success',
            context: null,
        });

        expect(sendWebMessage).toHaveBeenCalledWith(
            'what is this?',
            expect.any(Object),
            'gemini-web',
            files,
            null,
            expect.any(Function)
        );
    });

    it('keeps Gemini Web generated images for uploaded-image edit responses', async () => {
        const generatedImage = { url: 'https://lh3.googleusercontent.com/gg-dl/generated-edit' };
        sendWebMessage.mockResolvedValue({
            text: '',
            thoughts: null,
            images: [generatedImage],
            hasGeneratedImagePlaceholder: true,
            newContext: { atValue: 'new-at-token' },
        });
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ({ atValue: 'at-token' })),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);
        const files = [
            {
                name: 'image.png',
                type: 'image/png',
                base64: 'data:image/png;base64,AAAA',
            },
        ];

        await expect(
            dispatcher.dispatch(
                { text: 'edit this image', model: 'gemini-web', sessionId: 'session-web' },
                { provider: 'web' },
                files,
                vi.fn(),
                null
            )
        ).resolves.toEqual({
            action: 'GEMINI_REPLY',
            sessionId: 'session-web',
            text: '',
            thoughts: null,
            sources: [],
            images: [generatedImage],
            status: 'success',
            context: null,
        });
    });

    it('sends web requests with explicit local history and resets native context ids', async () => {
        getHistory.mockResolvedValue([
            { role: 'user', text: 'Remember code ALPHA.' },
            { role: 'ai', text: 'Remembered.' },
        ]);
        sendWebMessage.mockResolvedValue({
            text: 'ALPHA',
            thoughts: null,
            images: [],
            newContext: { atValue: 'new-at-token' },
        });
        const context = {
            atValue: 'at-token',
            contextIds: ['stale-conversation', 'stale-response', 'stale-choice'],
        };
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => context),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        await dispatcher.dispatch(
            {
                text: 'What code did I ask you to remember?',
                model: 'gemini-web',
                sessionId: 'session-web',
            },
            { provider: 'web' },
            [],
            vi.fn(),
            null
        );

        expect(sendWebMessage).toHaveBeenCalledWith(
            expect.stringContaining('Conversation history:'),
            expect.objectContaining({ atValue: 'at-token' }),
            'gemini-web',
            [],
            null,
            expect.any(Function)
        );
        expect(sendWebMessage.mock.calls[0][0]).toContain('User: Remember code ALPHA.');
        expect(sendWebMessage.mock.calls[0][0]).toContain('Assistant: Remembered.');
        expect(sendWebMessage.mock.calls[0][0]).toContain(
            'Current user message:\nWhat code did I ask you to remember?'
        );
        expect(sendWebMessage.mock.calls[0][1]).not.toHaveProperty('contextIds');
        expect(context.contextIds).toEqual([
            'stale-conversation',
            'stale-response',
            'stale-choice',
        ]);
    });

    it('passes normalized Gemini Web thinking level to the reverse provider', async () => {
        getHistory.mockResolvedValue([]);
        sendWebMessage.mockResolvedValue({
            text: 'web text',
            thoughts: null,
            images: [],
            newContext: { atValue: 'new-at-token' },
        });
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ({ atValue: 'at-token' })),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        await dispatcher.dispatch(
            {
                text: 'hello',
                model: 'e6fa609c3fa255c0',
                sessionId: 'session-web',
                webThinkingLevel: 'minimal',
            },
            { provider: 'web', webThinkingLevel: 'high' },
            [],
            vi.fn(),
            null
        );

        expect(sendWebMessage).toHaveBeenCalledWith(
            'hello',
            expect.any(Object),
            'e6fa609c3fa255c0',
            [],
            null,
            expect.any(Function),
            { thinkingLevel: 'low' }
        );
    });

    it('includes attachment-only history turns in Gemini Web local history prompts', async () => {
        getHistory.mockResolvedValue([
            {
                role: 'user',
                text: '用这张图生成变体',
                attachments: [
                    {
                        base64: 'data:image/png;base64,AAAA',
                        type: 'image/png',
                        name: 'image.png',
                    },
                    {
                        base64: 'data:application/pdf;base64,BBBB',
                        type: 'application/pdf',
                        name: 'spec.pdf',
                    },
                ],
            },
            {
                role: 'ai',
                text: '',
                generatedImages: [
                    { url: 'https://lh3.googleusercontent.com/generated-1' },
                    { url: 'https://lh3.googleusercontent.com/generated-2' },
                ],
            },
            {
                role: 'ai',
                text: '',
                sources: [{ url: 'https://example.test/source' }],
            },
        ]);
        sendWebMessage.mockResolvedValue({
            text: '可以继续',
            thoughts: null,
            images: [],
            newContext: { atValue: 'new-at-token' },
        });
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ({ atValue: 'at-token' })),
            updateContext: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        await dispatcher.dispatch(
            {
                text: '继续',
                model: 'gemini-web',
                sessionId: 'session-web',
            },
            { provider: 'web' },
            [],
            vi.fn(),
            null
        );

        const prompt = sendWebMessage.mock.calls[0][0];
        expect(prompt).toContain(
            'User: 用这张图生成变体 [1 image attachment(s)] [1 file attachment(s)]'
        );
        expect(prompt).toContain('Assistant: [2 generated image(s)]');
        expect(prompt).toContain('Assistant: [1 source link(s)]');
        expect(prompt).toContain('Current user message:\n继续');
    });

    it('omits the current user history row when the current request has non-image attachments', async () => {
        getHistory.mockResolvedValue([
            {
                role: 'user',
                text: 'Review attached spec',
                attachments: [
                    {
                        base64: 'data:application/pdf;base64,BBBB',
                        type: 'application/pdf',
                        name: 'spec.pdf',
                    },
                ],
            },
        ]);
        sendOfficialMessage.mockResolvedValue({
            text: 'official text',
            thoughts: null,
            sources: [],
            images: [],
        });
        const dispatcher = new RequestDispatcher({});

        await dispatcher.dispatch(
            {
                text: 'Review attached spec',
                model: 'gemini-test',
                sessionId: 'session-1',
            },
            {
                provider: 'official',
                apiKey: 'key',
                officialBaseUrl: 'https://api.example.test',
                officialModel: 'gemini-test',
            },
            [
                {
                    base64: 'data:application/pdf;base64,BBBB',
                    type: 'application/pdf',
                    name: 'spec.pdf',
                },
            ],
            vi.fn(),
            null
        );

        expect(prepareManagedContext).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            [],
            null,
            expect.any(Function)
        );
    });

    it('refreshes Web auth context and retries when upload tokens are missing', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        getHistory.mockResolvedValue([]);
        sendWebMessage
            .mockRejectedValueOnce(
                new Error('Missing Gemini Web upload tokens. Refresh Gemini Web authentication.')
            )
            .mockResolvedValueOnce({
                text: 'uploaded',
                thoughts: null,
                images: [],
                newContext: { atValue: 'fresh-at-token' },
            });

        const staleContext = {
            atValue: 'stale-at-token',
            blValue: 'stale-bl-token',
            fSid: 'stale-fsid-token',
            locale: 'zh-CN',
            authUser: '0',
            uploadPushId: null,
            uploadClientPctx: null,
        };
        const freshContext = {
            atValue: 'fresh-at-token',
            blValue: 'fresh-bl-token',
            fSid: 'fresh-fsid-token',
            locale: 'zh-CN',
            authUser: '0',
            uploadPushId: 'feeds/upload-dynamic',
            uploadClientPctx: 'client-pctx-token',
        };
        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi
                .fn()
                .mockResolvedValueOnce(staleContext)
                .mockResolvedValueOnce(freshContext),
            updateContext: vi.fn(),
            forceContextRefresh: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        const promise = dispatcher.dispatch(
            {
                text: '分析图片',
                model: 'gemini-web',
                sessionId: 'session-web',
            },
            { provider: 'web' },
            [{ name: 'image.png', base64: 'data:image/png;base64,AAAA' }],
            vi.fn(),
            null
        );

        await vi.waitFor(() => expect(sendWebMessage).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(2000);

        await expect(promise).resolves.toEqual(
            expect.objectContaining({
                action: 'GEMINI_REPLY',
                text: 'uploaded',
                status: 'success',
            })
        );
        expect(auth.forceContextRefresh).toHaveBeenCalledTimes(1);
        expect(auth.getOrFetchContext).toHaveBeenCalledTimes(2);
        expect(sendWebMessage.mock.calls[1][1]).toEqual(freshContext);
    });

    it('does not retry when Gemini Web request tokens are unavailable', async () => {
        getHistory.mockResolvedValue([]);
        sendWebMessage.mockRejectedValue(new Error('Missing Gemini Web auth token: blValue'));

        const auth = {
            accountIndices: [0],
            getOrFetchContext: vi.fn(async () => ({
                atValue: 'at-token',
                fSid: 'fsid-token',
                locale: 'zh-CN',
                authUser: '0',
                uploadPushId: 'feeds/upload-dynamic',
                uploadClientPctx: 'client-pctx-token',
            })),
            updateContext: vi.fn(),
            forceContextRefresh: vi.fn(),
        };
        const dispatcher = new RequestDispatcher(auth);

        await expect(
            dispatcher.dispatch(
                {
                    text: 'hello',
                    model: 'gemini-web',
                    sessionId: 'session-web',
                },
                { provider: 'web' },
                [],
                vi.fn(),
                null
            )
        ).rejects.toThrow('Missing Gemini Web auth token: blValue');

        expect(auth.getOrFetchContext).toHaveBeenCalledTimes(1);
        expect(auth.forceContextRefresh).not.toHaveBeenCalled();
        expect(sendWebMessage).toHaveBeenCalledTimes(1);
    });
});
