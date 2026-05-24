import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConnectionSettings } from './settings_store.js';

describe('getConnectionSettings', () => {
    let storedSettings;

    beforeEach(() => {
        storedSettings = {};
        globalThis.chrome = {
            storage: {
                local: {
                    get: vi.fn(async () => storedSettings),
                    set: vi.fn(async () => {}),
                },
            },
        };
    });

    afterEach(() => {
        delete globalThis.chrome;
        vi.restoreAllMocks();
    });

    it('rotates official API keys from the stored pointer and wraps to the first key', async () => {
        storedSettings = {
            geminiProvider: 'official',
            geminiApiKey: ' key-a, key-b, key-c ',
            geminiApiKeyPointer: 2,
        };

        const settings = await getConnectionSettings();

        expect(settings.apiKey).toBe('key-c');
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ geminiApiKeyPointer: 0 });
    });

    it('resets an out-of-bounds official API key pointer before advancing it', async () => {
        storedSettings = {
            geminiProvider: 'official',
            geminiApiKey: 'key-a,key-b',
            geminiApiKeyPointer: 9,
        };

        const settings = await getConnectionSettings();

        expect(settings.apiKey).toBe('key-a');
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ geminiApiKeyPointer: 1 });
    });

    it('restores Gemini Web thinking level with a high default', async () => {
        storedSettings = {
            geminiProvider: 'web',
            geminiWebThinkingLevel: 'minimal',
        };

        await expect(getConnectionSettings()).resolves.toEqual(
            expect.objectContaining({
                provider: 'web',
                webThinkingLevel: 'minimal',
            })
        );

        storedSettings = { geminiProvider: 'web' };
        await expect(getConnectionSettings()).resolves.toEqual(
            expect.objectContaining({
                webThinkingLevel: 'high',
            })
        );
    });
});
