import {
    DEFAULT_CONTEXT_MODE,
    DEFAULT_CONTEXT_RECENT_TURNS,
    DEFAULT_OFFICIAL_BASE_URL,
    DEFAULT_OFFICIAL_MODELS,
    DEFAULT_THINKING_LEVEL,
} from '../../../shared/config/constants.js';
import {
    getConnectionProvider,
    getOpenAIWebSearchStorageKeys,
} from '../../../shared/settings/connection.js';
import { normalizeWebThinkingLevel } from '../../../shared/models/web_thinking.js';
import { normalizeOpenAIWebSearchSettings } from '../../../shared/settings/openai.js';
import { debugLog } from '../../../shared/logging/debug.js';

export async function getConnectionSettings() {
    const stored = await chrome.storage.local.get([
        'geminiProvider',
        'geminiUseOfficialApi',
        'geminiWebThinkingLevel',
        'geminiOfficialBaseUrl',
        'geminiApiKey',
        'geminiOfficialModel',
        'geminiThinkingLevel',
        'geminiOfficialWebSearch',
        'geminiApiKeyPointer',
        'geminiOpenaiBaseUrl',
        'geminiOpenaiApiKey',
        'geminiOpenaiModel',
        'geminiOpenaiThinkingLevel',
        'geminiOpenaiUseResponsesApi',
        'geminiOpenaiWebSearchMode',
        'geminiOpenaiWebSearch',
        'geminiContextMode',
        'geminiContextRecentTurns',
    ]);

    const provider = getConnectionProvider(stored);

    let activeApiKey = stored.geminiApiKey || '';

    if (provider === 'official' && activeApiKey.includes(',')) {
        const apiKeys = activeApiKey
            .split(',')
            .map((apiKey) => apiKey.trim())
            .filter((apiKey) => apiKey);

        if (apiKeys.length > 0) {
            let pointer = stored.geminiApiKeyPointer || 0;

            if (typeof pointer !== 'number' || pointer >= apiKeys.length || pointer < 0) {
                pointer = 0;
            }

            activeApiKey = apiKeys[pointer];

            const nextPointer = (pointer + 1) % apiKeys.length;
            await chrome.storage.local.set({ geminiApiKeyPointer: nextPointer });

            debugLog(`[Gemini Nexus] Rotating Official API Key (Index: ${pointer})`);
        }
    } else {
        activeApiKey = activeApiKey.trim();
    }

    const openaiSettings = normalizeOpenAIWebSearchSettings(
        stored,
        getOpenAIWebSearchStorageKeys()
    );

    return {
        provider: provider,
        webThinkingLevel: normalizeWebThinkingLevel(stored.geminiWebThinkingLevel),
        officialBaseUrl: stored.geminiOfficialBaseUrl || DEFAULT_OFFICIAL_BASE_URL,
        apiKey: activeApiKey,
        officialModel: stored.geminiOfficialModel || DEFAULT_OFFICIAL_MODELS,
        thinkingLevel: stored.geminiThinkingLevel || DEFAULT_THINKING_LEVEL,
        officialWebSearch: stored.geminiOfficialWebSearch === true,
        openaiBaseUrl: stored.geminiOpenaiBaseUrl,
        openaiApiKey: stored.geminiOpenaiApiKey,
        openaiModel: stored.geminiOpenaiModel,
        openaiThinkingLevel: stored.geminiOpenaiThinkingLevel || DEFAULT_THINKING_LEVEL,
        openaiUseResponsesApi: openaiSettings.useResponsesApi,
        openaiWebSearch: openaiSettings.webSearch,
        contextMode: stored.geminiContextMode || DEFAULT_CONTEXT_MODE,
        contextRecentTurns: stored.geminiContextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS,
    };
}
