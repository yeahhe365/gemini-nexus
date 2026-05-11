// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageBridge } from './bridge.js';

function createFrame() {
    const sandboxWindow = {};
    return {
        getWindow: vi.fn(() => sandboxWindow),
        isWindow: vi.fn((source) => source === sandboxWindow),
        postMessage: vi.fn()
    };
}

function createState() {
    return {
        getCached: vi.fn(),
        getCurrentTabId: vi.fn(() => null),
        markUiReady: vi.fn(),
        save: vi.fn(),
        updateSessions: vi.fn()
    };
}

describe('MessageBridge model persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.chrome = {
            runtime: {
                onMessage: { addListener: vi.fn() },
                sendMessage: vi.fn(() => Promise.resolve())
            },
            storage: {
                local: {
                    get: vi.fn(),
                    set: vi.fn()
                },
                session: {
                    get: vi.fn(),
                    set: vi.fn()
                }
            },
            tabs: {
                create: vi.fn()
            }
        };
    });

    it('saves OpenAI model selections in the OpenAI-specific preference key', () => {
        const frame = createFrame();
        const state = createState();
        const bridge = new MessageBridge(frame, state);

        bridge.handleWindowMessage({
            source: frame.getWindow(),
            data: {
                action: 'SAVE_MODEL',
                payload: {
                    provider: 'openai',
                    model: 'gpt-5'
                }
            }
        });

        expect(state.save).toHaveBeenCalledWith('geminiOpenaiSelectedModel', 'gpt-5');
        expect(state.save).not.toHaveBeenCalledWith('geminiModel', 'gpt-5');
    });

    it('keeps legacy string model saves on the global Gemini model key', () => {
        const frame = createFrame();
        const state = createState();
        const bridge = new MessageBridge(frame, state);

        bridge.handleWindowMessage({
            source: frame.getWindow(),
            data: {
                action: 'SAVE_MODEL',
                payload: 'gemini-3-flash'
            }
        });

        expect(state.save).toHaveBeenCalledWith('geminiModel', 'gemini-3-flash');
    });
});
