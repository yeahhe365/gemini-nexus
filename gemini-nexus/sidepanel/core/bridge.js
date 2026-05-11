
// sidepanel/core/bridge.js
import { downloadFile, downloadText } from '../utils/download.js';
import { DEFAULT_CONTEXT_RECENT_TURNS } from '../../lib/constants.js';

const OPENAI_WEB_SEARCH_MODES = new Set(['off', 'responses', 'chat']);

function normalizeOpenAISettings(data) {
    const legacyMode = data.geminiOpenaiWebSearchMode ?? data.openaiWebSearchMode;
    const hasUseResponsesSetting = typeof data.geminiOpenaiUseResponsesApi === 'boolean' || typeof data.openaiUseResponsesApi === 'boolean';
    const hasWebSearchSetting = typeof data.geminiOpenaiWebSearch === 'boolean' || typeof data.openaiWebSearch === 'boolean';
    const legacyEnabled = data.geminiOpenaiWebSearch === true || data.openaiWebSearch === true;

    if (!hasUseResponsesSetting && OPENAI_WEB_SEARCH_MODES.has(legacyMode)) {
        return {
            useResponsesApi: legacyMode === 'responses',
            webSearch: legacyMode === 'responses' || legacyMode === 'chat'
        };
    }

    return {
        useResponsesApi: data.geminiOpenaiUseResponsesApi === true || data.openaiUseResponsesApi === true,
        webSearch: hasWebSearchSetting ? legacyEnabled : false
    };
}

function getSelectedModelForProvider(data, provider) {
    if (provider === 'openai') {
        return data.geminiOpenaiSelectedModel || data.geminiModel || 'openai_custom';
    }

    return data.geminiModel || 'gemini-2.5-flash';
}

function getModelSaveKey(payload) {
    if (payload && typeof payload === 'object') {
        return payload.provider === 'openai' ? 'geminiOpenaiSelectedModel' : 'geminiModel';
    }

    return 'geminiModel';
}

function getModelSaveValue(payload) {
    if (payload && typeof payload === 'object') {
        return payload.model;
    }

    return payload;
}

export class MessageBridge {
    constructor(frameManager, stateManager) {
        this.frame = frameManager;
        this.state = stateManager;
    }

    init() {
        window.addEventListener('message', this.handleWindowMessage.bind(this));
        chrome.runtime.onMessage.addListener(this.handleRuntimeMessage.bind(this));
    }

    handleWindowMessage(event) {
        // Security check: Only accept messages from our direct iframe
        if (!this.frame.isWindow(event.source)) return;

        const { action, payload } = event.data;

        // 1. Handshake
        if (action === 'UI_READY') {
            this.state.markUiReady();
            return;
        }

        // 2. Window Management
        if (action === 'OPEN_FULL_PAGE') {
            const url = chrome.runtime.getURL('sidepanel/index.html');
            chrome.tabs.create({ url });
            return;
        }
        if (action === 'OPEN_EXTERNAL_URL') {
            const url = payload?.url;
            if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
                chrome.tabs.create({ url });
            }
            return;
        }

        // 3. Background Forwarding
        if (action === 'FORWARD_TO_BACKGROUND') {
            const scopedPayload = this._attachCurrentTabContext(payload);
            chrome.runtime.sendMessage(scopedPayload)
                .then(response => {
                    // If request demands a reply (e.g., GET_LOGS, CHECK_PAGE_CONTEXT), send it back
                    if (response && (scopedPayload.action === 'GET_LOGS' || scopedPayload.action === 'CHECK_PAGE_CONTEXT' || scopedPayload.action === 'MCP_TEST_CONNECTION' || scopedPayload.action === 'MCP_LIST_TOOLS')) {
                        this.frame.postMessage({
                            action: 'BACKGROUND_MESSAGE',
                            payload: response
                        });
                    }
                })
                .catch(err => console.warn("Error forwarding to background:", err));
            return;
        }

        // 4. Downloads
        if (action === 'DOWNLOAD_IMAGE') {
            downloadFile(payload.url, payload.filename);
            return;
        }
        if (action === 'DOWNLOAD_LOGS') {
            downloadText(payload.text, payload.filename || 'gemini-nexus-logs.txt');
            return;
        }

        // 5. Data Getters (Immediate Response)
        if (action === 'GET_THEME') {
            this.frame.postMessage({ action: 'RESTORE_THEME', payload: this.state.getCached('geminiTheme') });
            return;
        }
        if (action === 'GET_LANGUAGE') {
            this.frame.postMessage({ action: 'RESTORE_LANGUAGE', payload: this.state.getCached('geminiLanguage') });
            return;
        }
        if (action === 'GET_TEXT_SELECTION') {
            // Some keys might not be in initial bulk fetch if added later, but usually are.
            // Fallback to async storage if needed, but state.data usually has it.
            chrome.storage.local.get(['geminiTextSelectionEnabled'], (res) => {
                const val = res.geminiTextSelectionEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_TEXT_SELECTION', payload: val });
            });
            return;
        }
        if (action === 'GET_IMAGE_TOOLS') {
            chrome.storage.local.get(['geminiImageToolsEnabled'], (res) => {
                const val = res.geminiImageToolsEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_IMAGE_TOOLS', payload: val });
            });
            return;
        }
        if (action === 'GET_ACCOUNT_INDICES') {
            chrome.storage.local.get(['geminiAccountIndices'], (res) => {
                this.frame.postMessage({ action: 'RESTORE_ACCOUNT_INDICES', payload: res.geminiAccountIndices || "0" });
            });
            return;
        }
        if (action === 'GET_CONTEXT_SETTINGS') {
            chrome.storage.local.get(['geminiContextMode', 'geminiContextRecentTurns'], (res) => {
                this.frame.postMessage({
                    action: 'RESTORE_CONTEXT_SETTINGS',
                    payload: {
                        mode: res.geminiContextMode || 'summary',
                        recentTurns: res.geminiContextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS
                    }
                });
            });
            return;
        }
        if (action === 'GET_CONNECTION_SETTINGS') {
            chrome.storage.local.get([
                'geminiProvider',
                'geminiUseOfficialApi', 
                'geminiOfficialBaseUrl',
                'geminiApiKey', 
                'geminiOfficialModel',
                'geminiThinkingLevel',
                'geminiOfficialWebSearch',
                'geminiOpenaiBaseUrl',
                'geminiOpenaiApiKey',
                'geminiOpenaiModel',
                'geminiOpenaiSelectedModel',
                'geminiOpenaiThinkingLevel',
                'geminiOpenaiUseResponsesApi',
                'geminiOpenaiWebSearchMode',
                'geminiOpenaiWebSearch',
                'geminiMcpEnabled',
                'geminiMcpTransport',
                'geminiMcpServerUrl',
                'geminiMcpServers',
                'geminiMcpActiveServerId'
            ], (res) => {
                const openaiSettings = normalizeOpenAISettings(res);
                const provider = res.geminiProvider || (res.geminiUseOfficialApi ? 'official' : 'web');
                const selectedModel = getSelectedModelForProvider(res, provider);
                this.frame.postMessage({ 
                    action: 'RESTORE_CONNECTION_SETTINGS', 
                    payload: { 
                        provider,
                        useOfficialApi: res.geminiUseOfficialApi === true, 
                        selectedModel,
                        openaiSelectedModel: res.geminiOpenaiSelectedModel || "",
                        officialBaseUrl: res.geminiOfficialBaseUrl || "https://generativelanguage.googleapis.com/v1beta",
                        apiKey: res.geminiApiKey || "",
                        officialModel: res.geminiOfficialModel || "gemini-3-flash-preview, gemini-3-pro-preview",
                        thinkingLevel: res.geminiThinkingLevel || "low",
                        officialWebSearch: res.geminiOfficialWebSearch === true,
                        openaiBaseUrl: res.geminiOpenaiBaseUrl || "",
                        openaiApiKey: res.geminiOpenaiApiKey || "",
                        openaiModel: res.geminiOpenaiModel || "",
                        openaiThinkingLevel: res.geminiOpenaiThinkingLevel || "low",
                        openaiUseResponsesApi: openaiSettings.useResponsesApi,
                        openaiWebSearch: openaiSettings.webSearch,
                        // MCP
                        mcpEnabled: res.geminiMcpEnabled === true,
                        mcpTransport: res.geminiMcpTransport || "sse",
                        mcpServerUrl: res.geminiMcpServerUrl || "http://127.0.0.1:3006/sse",
                        mcpServers: Array.isArray(res.geminiMcpServers) ? res.geminiMcpServers : null,
                        mcpActiveServerId: res.geminiMcpActiveServerId || null
                    } 
                });
            });
            return;
        }

        // 6. Data Setters (Sync to Storage & Cache)
        if (action === 'SAVE_SESSIONS') this.state.save('geminiSessions', payload);
        if (action === 'SAVE_SHORTCUTS') this.state.save('geminiShortcuts', payload);
        if (action === 'SAVE_MODEL') {
            const model = getModelSaveValue(payload);
            if (typeof model === 'string' && model.trim()) {
                this.state.save(getModelSaveKey(payload), model);
            }
        }
        if (action === 'SAVE_THEME') this.state.save('geminiTheme', payload);
        if (action === 'SAVE_LANGUAGE') this.state.save('geminiLanguage', payload);
        if (action === 'SAVE_TEXT_SELECTION') this.state.save('geminiTextSelectionEnabled', payload);
        if (action === 'SAVE_IMAGE_TOOLS') this.state.save('geminiImageToolsEnabled', payload);
        if (action === 'SAVE_SIDEBAR_BEHAVIOR') this.state.save('geminiSidebarBehavior', payload);
        if (action === 'SAVE_SIDE_PANEL_SCOPE') this.state.save('geminiSidePanelScope', payload);
        if (action === 'SAVE_SIDE_PANEL_SESSION_BINDING') {
            const tabId = payload?.tabId;
            const sessionId = payload?.sessionId || null;
            if (Number.isInteger(tabId) && tabId > 0) {
                chrome.storage.session.get(['geminiSidePanelSessionBindings'], (result) => {
                    const bindings = result.geminiSidePanelSessionBindings || {};
                    if (sessionId) {
                        bindings[tabId] = sessionId;
                    } else {
                        delete bindings[tabId];
                    }
                    chrome.storage.session.set({ geminiSidePanelSessionBindings: bindings });
                });
            }
        }
        if (action === 'SAVE_ACCOUNT_INDICES') this.state.save('geminiAccountIndices', payload);
        if (action === 'SAVE_CONTEXT_SETTINGS') {
            this.state.save('geminiContextMode', payload?.mode === 'recent' ? 'recent' : 'summary');
            const recentTurns = Number.parseInt(payload?.recentTurns, 10);
            this.state.save('geminiContextRecentTurns', Number.isFinite(recentTurns) ? Math.min(50, Math.max(1, recentTurns)) : DEFAULT_CONTEXT_RECENT_TURNS);
        }
        if (action === 'SAVE_CONNECTION_SETTINGS') {
            this.state.save('geminiProvider', payload.provider);
            // Official
            this.state.save('geminiUseOfficialApi', payload.provider === 'official'); // Maintain legacy bool for now
            this.state.save('geminiOfficialBaseUrl', payload.officialBaseUrl || "https://generativelanguage.googleapis.com/v1beta");
            this.state.save('geminiApiKey', payload.apiKey);
            this.state.save('geminiOfficialModel', payload.officialModel || "gemini-3-flash-preview, gemini-3-pro-preview");
            this.state.save('geminiThinkingLevel', payload.thinkingLevel);
            this.state.save('geminiOfficialWebSearch', payload.officialWebSearch === true);
            // OpenAI
            this.state.save('geminiOpenaiBaseUrl', payload.openaiBaseUrl);
            this.state.save('geminiOpenaiApiKey', payload.openaiApiKey);
            this.state.save('geminiOpenaiModel', payload.openaiModel);
            this.state.save('geminiOpenaiThinkingLevel', payload.openaiThinkingLevel || "low");
            this.state.save('geminiOpenaiUseResponsesApi', payload.openaiUseResponsesApi === true);
            this.state.save('geminiOpenaiWebSearch', payload.openaiWebSearch === true);
            // MCP
            this.state.save('geminiMcpEnabled', payload.mcpEnabled === true);
            this.state.save('geminiMcpTransport', payload.mcpTransport || "sse");
            this.state.save('geminiMcpServerUrl', payload.mcpServerUrl || "");
            this.state.save('geminiMcpServers', Array.isArray(payload.mcpServers) ? payload.mcpServers : []);
            this.state.save('geminiMcpActiveServerId', payload.mcpActiveServerId || null);
        }
    }

    handleRuntimeMessage(message) {
        if (!this._isMessageForCurrentTab(message)) return;

        if (message.action === 'SESSIONS_UPDATED') {
            this.state.updateSessions(message.sessions);
            this.frame.postMessage({
                action: 'RESTORE_SESSIONS',
                payload: message.sessions
            });
            return;
        }

        // Forward all other background messages to sandbox (e.g. GEMINI_STREAM_UPDATE)
        this.frame.postMessage({
            action: 'BACKGROUND_MESSAGE',
            payload: message
        });
    }

    _attachCurrentTabContext(payload) {
        if (!payload || typeof payload !== 'object' || payload.sidePanelTabId != null) {
            return payload;
        }

        const currentTabId = this.state.getCurrentTabId();
        if (!Number.isInteger(currentTabId) || currentTabId <= 0) {
            return payload;
        }

        return {
            ...payload,
            sidePanelTabId: currentTabId
        };
    }

    _isMessageForCurrentTab(message) {
        if (!message || !Object.prototype.hasOwnProperty.call(message, 'tabId')) {
            return true;
        }

        const currentTabId = this.state.getCurrentTabId();
        return message.tabId == null || message.tabId === currentTabId;
    }
}
