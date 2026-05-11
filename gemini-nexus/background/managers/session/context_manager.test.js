import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareManagedContext } from './context_manager.js';
import { sendOfficialMessage } from '../../../services/providers/official.js';
import { getSessionContextSummary, updateSessionContextSummary } from '../history_manager.js';

vi.mock('../../../services/providers/official.js', () => ({
    sendOfficialMessage: vi.fn()
}));

vi.mock('../../../services/providers/openai_compatible.js', () => ({
    sendOpenAIMessage: vi.fn()
}));

vi.mock('../history_manager.js', () => ({
    getSessionContextSummary: vi.fn(),
    updateSessionContextSummary: vi.fn()
}));

function user(text, extra = {}) {
    return { role: 'user', text, ...extra };
}

function ai(text, extra = {}) {
    return { role: 'ai', text, ...extra };
}

describe('prepareManagedContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionContextSummary.mockResolvedValue(null);
        sendOfficialMessage.mockResolvedValue({ text: 'compressed summary' });
    });

    it('passes through web provider history without compression', async () => {
        const history = [user('one'), ai('two')];

        await expect(prepareManagedContext(
            { systemInstruction: 'system' },
            { provider: 'web' },
            history
        )).resolves.toEqual({
            history,
            systemInstruction: 'system'
        });

        expect(getSessionContextSummary).not.toHaveBeenCalled();
    });

    it('keeps only recent conversation user turns in recent mode and ignores tool outputs', async () => {
        const history = [
            user('old user'),
            ai('old ai'),
            user('[Tool Output: click]\nclicked', { kind: 'tool-output' }),
            user('recent user 1'),
            ai('recent ai 1'),
            user('recent user 2'),
            ai('recent ai 2')
        ];

        await expect(prepareManagedContext(
            { systemInstruction: '' },
            {
                provider: 'official',
                contextMode: 'recent',
                contextRecentTurns: 2
            },
            history
        )).resolves.toEqual({
            history: history.slice(3),
            systemInstruction: ''
        });
    });

    it('uses an existing compressed summary when the unsummarized tail is below the threshold', async () => {
        const history = [
            user('old user'),
            ai('old ai'),
            user('tail user'),
            ai('tail ai')
        ];
        getSessionContextSummary.mockResolvedValue({
            text: 'prior summary',
            sourceMessageCount: 2
        });

        const result = await prepareManagedContext(
            {
                sessionId: 'session-1',
                systemInstruction: 'system'
            },
            {
                provider: 'official',
                contextMode: 'summary',
                contextRecentTurns: 2
            },
            history
        );

        expect(result).toEqual({
            history: [
                {
                    role: 'user',
                    text: '[Hidden compressed conversation history]\nprior summary'
                },
                user('tail user'),
                ai('tail ai')
            ],
            systemInstruction: 'system'
        });
        expect(sendOfficialMessage).not.toHaveBeenCalled();
    });

    it('compresses summary-mode history once the recent-turn threshold is reached', async () => {
        const onStatus = vi.fn();
        const history = [
            user('old user'),
            ai('old ai'),
            user('recent user'),
            ai('recent ai')
        ];

        const result = await prepareManagedContext(
            {
                sessionId: 'session-1',
                model: 'gemini-summary',
                systemInstruction: ''
            },
            {
                provider: 'official',
                contextMode: 'summary',
                contextRecentTurns: 2,
                officialBaseUrl: 'https://example.com',
                apiKey: 'key',
                officialModel: 'gemini-main'
            },
            history,
            null,
            onStatus
        );

        expect(sendOfficialMessage).toHaveBeenCalledWith(
            expect.stringContaining('Conversation history to compress:'),
            expect.any(String),
            [],
            expect.objectContaining({
                baseUrl: 'https://example.com',
                apiKey: 'key',
                model: 'gemini-summary',
                configuredModels: 'gemini-main'
            }),
            null,
            [],
            false,
            null,
            expect.any(Function)
        );
        expect(updateSessionContextSummary).toHaveBeenCalledWith('session-1', expect.objectContaining({
            text: 'compressed summary',
            sourceMessageCount: history.length,
            updatedAt: expect.any(Number)
        }));
        expect(onStatus).toHaveBeenCalledWith('compressing', { recentTurns: 2 });
        expect(onStatus).toHaveBeenCalledWith('compressed', { recentTurns: 2 });
        expect(result).toEqual({
            history: [
                {
                    role: 'user',
                    text: '[Hidden compressed conversation history]\ncompressed summary'
                }
            ],
            systemInstruction: ''
        });
    });
});
