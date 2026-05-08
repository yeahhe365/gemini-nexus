
// background/managers/session/settings_store.js
import { DEFAULT_CONTEXT_RECENT_TURNS } from '../../../lib/constants.js';

const OPENAI_WEB_SEARCH_MODES = new Set(['off', 'responses', 'chat']);

function normalizeOpenAISettings(stored) {
    const legacyMode = stored.geminiOpenaiWebSearchMode;
    const legacyEnabled = stored.geminiOpenaiWebSearch === true;
    const hasUseResponsesSetting = typeof stored.geminiOpenaiUseResponsesApi === 'boolean';
    const hasWebSearchSetting = typeof stored.geminiOpenaiWebSearch === 'boolean';

    if (!hasUseResponsesSetting && OPENAI_WEB_SEARCH_MODES.has(legacyMode)) {
        return {
            useResponsesApi: legacyMode === 'responses',
            webSearch: legacyMode === 'responses' || legacyMode === 'chat'
        };
    }

    return {
        useResponsesApi: stored.geminiOpenaiUseResponsesApi === true,
        webSearch: hasWebSearchSetting ? legacyEnabled : false
    };
}

export async function getConnectionSettings() {
    const stored = await chrome.storage.local.get([
        'geminiProvider',
        'geminiUseOfficialApi', 
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
        'geminiContextRecentTurns'
    ]);

    // Legacy Migration Logic
    let provider = stored.geminiProvider;
    if (!provider) {
        provider = stored.geminiUseOfficialApi === true ? 'official' : 'web';
    }

    let activeApiKey = stored.geminiApiKey || "";

    // Handle API Key Rotation (Comma separated) for Official Gemini
    if (provider === 'official' && activeApiKey.includes(',')) {
        const keys = activeApiKey.split(',').map(k => k.trim()).filter(k => k);
        
        if (keys.length > 0) {
            let pointer = stored.geminiApiKeyPointer || 0;
            
            // Reset pointer if out of bounds (e.g. keys removed)
            if (typeof pointer !== 'number' || pointer >= keys.length || pointer < 0) {
                pointer = 0;
            }
            
            activeApiKey = keys[pointer];
            
            // Advance pointer for next call
            const nextPointer = (pointer + 1) % keys.length;
            await chrome.storage.local.set({ geminiApiKeyPointer: nextPointer });
            
            console.log(`[Gemini Nexus] Rotating Official API Key (Index: ${pointer})`);
        }
    } else {
        // Trim single key just in case
        activeApiKey = activeApiKey.trim();
    }

    const openaiSettings = normalizeOpenAISettings(stored);

    return {
        provider: provider,
        // Official
        officialBaseUrl: stored.geminiOfficialBaseUrl || "https://generativelanguage.googleapis.com/v1beta",
        apiKey: activeApiKey,
        officialModel: stored.geminiOfficialModel || "gemini-3-flash-preview, gemini-3-pro-preview",
        thinkingLevel: stored.geminiThinkingLevel || "low",
        officialWebSearch: stored.geminiOfficialWebSearch === true,
        // OpenAI
        openaiBaseUrl: stored.geminiOpenaiBaseUrl,
        openaiApiKey: stored.geminiOpenaiApiKey,
        openaiModel: stored.geminiOpenaiModel,
        openaiThinkingLevel: stored.geminiOpenaiThinkingLevel || "low",
        openaiUseResponsesApi: openaiSettings.useResponsesApi,
        openaiWebSearch: openaiSettings.webSearch,
        // Context management
        contextMode: stored.geminiContextMode || "summary",
        contextRecentTurns: stored.geminiContextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS
    };
}
