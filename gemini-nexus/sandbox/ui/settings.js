
// sandbox/ui/settings.js
import { saveShortcutsToStorage, saveThemeToStorage, requestThemeFromStorage, saveLanguageToStorage, requestLanguageFromStorage, saveTextSelectionToStorage, requestTextSelectionFromStorage, saveSidebarBehaviorToStorage, saveSidePanelScopeToStorage, saveImageToolsToStorage, requestImageToolsFromStorage, saveAccountIndicesToStorage, requestAccountIndicesFromStorage, saveContextSettingsToStorage, requestContextSettingsFromStorage, saveConnectionSettingsToStorage, requestConnectionSettingsFromStorage, sendToBackground } from '../../lib/messaging.js';
import { setLanguagePreference, getLanguagePreference } from '../core/i18n.js';
import { SettingsView } from './settings/view.js';
import { DEFAULT_CONTEXT_RECENT_TURNS, DEFAULT_SHORTCUTS } from '../../lib/constants.js';

const OPENAI_WEB_SEARCH_MODES = new Set(['off', 'responses', 'chat']);

function normalizeOpenAISettings(data) {
    const hasUseResponsesSetting = typeof data.openaiUseResponsesApi === 'boolean';
    const hasWebSearchSetting = typeof data.openaiWebSearch === 'boolean';

    if (!hasUseResponsesSetting && OPENAI_WEB_SEARCH_MODES.has(data.openaiWebSearchMode)) {
        return {
            useResponsesApi: data.openaiWebSearchMode === 'responses',
            webSearch: data.openaiWebSearchMode === 'responses' || data.openaiWebSearchMode === 'chat'
        };
    }

    return {
        useResponsesApi: data.openaiUseResponsesApi === true,
        webSearch: hasWebSearchSetting ? data.openaiWebSearch === true : false
    };
}

export class SettingsController {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        
        // State
        this.defaultShortcuts = { ...DEFAULT_SHORTCUTS };
        this.shortcuts = { ...this.defaultShortcuts };
        
        this.textSelectionEnabled = true;
        this.imageToolsEnabled = true;
        this.accountIndices = "0";
        this.sidebarBehavior = 'auto';
        this.sidePanelScope = 'remembered_tabs';
        this.contextSettings = {
            mode: 'summary',
            recentTurns: DEFAULT_CONTEXT_RECENT_TURNS
        };
        
        // Connection State
        this.connectionData = {
            provider: 'web',
            useOfficialApi: false, // Legacy support
            officialBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
            apiKey: "",
            officialModel: "gemini-3-flash-preview, gemini-3-pro-preview",
            thinkingLevel: "low",
            officialWebSearch: false,
            openaiBaseUrl: "",
            openaiApiKey: "",
            openaiModel: "",
            openaiSelectedModel: "",
            openaiThinkingLevel: "low",
            openaiUseResponsesApi: false,
            openaiWebSearch: false,
            // MCP (External Tools)
            mcpEnabled: false,
            mcpTransport: "sse",
            mcpServerUrl: "http://127.0.0.1:3006/sse",
            mcpServers: [{
                id: `srv_${Date.now()}`,
                name: "Local Proxy",
                transport: "sse",
                url: "http://127.0.0.1:3006/sse",
                headers: {},
                enabled: true,
                toolMode: "all",
                enabledTools: []
            }],
            mcpActiveServerId: null
        };

        // Initialize View
        this.view = new SettingsView({
            onOpen: () => this.handleOpen(),
            onSave: (data) => this.saveSettings(data),
            onReset: () => this.resetSettings(),
            
            onThemeChange: (theme) => this.setTheme(theme),
            onLanguageChange: (lang) => this.setLanguage(lang),
            
            onTextSelectionChange: (val) => { this.textSelectionEnabled = (val === 'on' || val === true); saveTextSelectionToStorage(this.textSelectionEnabled); },
            onImageToolsChange: (val) => { this.imageToolsEnabled = (val === 'on' || val === true); saveImageToolsToStorage(this.imageToolsEnabled); },
            onSidebarBehaviorChange: (val) => { this.sidebarBehavior = val || 'auto'; saveSidebarBehaviorToStorage(this.sidebarBehavior); },
            onSidePanelScopeChange: (val) => { this.sidePanelScope = val || 'remembered_tabs'; saveSidePanelScopeToStorage(this.sidePanelScope); },
            onDownloadLogs: () => this.downloadLogs()
        });
        
        // External Trigger Binding
        const trigger = document.getElementById('settings-btn');
        if(trigger) {
            trigger.addEventListener('click', () => {
                this.open();
                if (this.callbacks.onOpen) this.callbacks.onOpen();
            });
        }
        
        // Listen for log data
        window.addEventListener('message', (e) => {
            if (e.data.action === 'BACKGROUND_MESSAGE' && e.data.payload && e.data.payload.logs) {
                this.saveLogFile(e.data.payload.logs);
            }
        });
    }

    open() {
        this.view.open();
    }

    close() {
        this.view.close();
    }

    handleOpen() {
        // Sync state to view
        this.view.setShortcuts(this.shortcuts);
        this.view.setLanguageValue(getLanguagePreference());
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
        this.view.setAccountIndices(this.accountIndices);
        this.view.setSidebarBehavior(this.sidebarBehavior);
        this.view.setSidePanelScope(this.sidePanelScope);
        this.view.setContextSettings(this.contextSettings);
        this.view.setConnectionSettings(this.connectionData);
        
        // Refresh from storage
        requestTextSelectionFromStorage();
        requestImageToolsFromStorage();
        requestAccountIndicesFromStorage();
        requestContextSettingsFromStorage();
        requestConnectionSettingsFromStorage();
        
        this.fetchGithubData();
    }

    saveSettings(data) {
        const previousProvider = this.connectionData.provider || (this.connectionData.useOfficialApi ? 'official' : 'web');

        // Shortcuts
        this.shortcuts = data.shortcuts;
        saveShortcutsToStorage(this.shortcuts);
        
        // General Toggles
        this.textSelectionEnabled = data.textSelection;
        saveTextSelectionToStorage(this.textSelectionEnabled);
        
        this.imageToolsEnabled = data.imageTools;
        saveImageToolsToStorage(this.imageToolsEnabled);
        
        // Accounts
        let val = data.accountIndices.trim();
        if (!val) val = "0";
        this.accountIndices = val;
        const cleaned = val.replace(/[^0-9,]/g, '');
        saveAccountIndicesToStorage(cleaned);

        this.sidebarBehavior = data.sidebarBehavior || 'auto';
        saveSidebarBehaviorToStorage(this.sidebarBehavior);

        this.sidePanelScope = data.sidePanelScope || 'remembered_tabs';
        saveSidePanelScopeToStorage(this.sidePanelScope);

        this.contextSettings = {
            mode: data.contextMode === 'recent' ? 'recent' : 'summary',
            recentTurns: this.normalizeRecentTurns(data.contextRecentTurns)
        };
        saveContextSettingsToStorage(this.contextSettings);
        
        const openaiSettings = normalizeOpenAISettings(data.connection);

        // Connection
        this.connectionData = {
            provider: data.connection.provider,
            officialBaseUrl: data.connection.officialBaseUrl,
            apiKey: data.connection.apiKey,
            officialModel: data.connection.officialModel,
            thinkingLevel: data.connection.thinkingLevel,
            officialWebSearch: data.connection.officialWebSearch === true,
            openaiBaseUrl: data.connection.openaiBaseUrl,
            openaiApiKey: data.connection.openaiApiKey,
            openaiModel: data.connection.openaiModel,
            openaiSelectedModel: this.connectionData.openaiSelectedModel || "",
            openaiThinkingLevel: data.connection.openaiThinkingLevel || "low",
            openaiUseResponsesApi: openaiSettings.useResponsesApi,
            openaiWebSearch: openaiSettings.webSearch,
            // MCP
            mcpEnabled: data.connection.mcpEnabled === true,
            mcpTransport: data.connection.mcpTransport || "sse",
            mcpServerUrl: data.connection.mcpServerUrl || "",
            mcpServers: Array.isArray(data.connection.mcpServers) ? data.connection.mcpServers : [],
            mcpActiveServerId: data.connection.mcpActiveServerId || null
        };
        
        saveConnectionSettingsToStorage(this.connectionData);

        // Notify app of critical setting changes
        if (this.callbacks.onSettingsChanged) {
            this.callbacks.onSettingsChanged(this.connectionData, {
                providerChanged: previousProvider !== this.connectionData.provider
            });
        }
    }

    resetSettings() {
        this.view.setShortcuts(this.defaultShortcuts);
        this.view.setAccountIndices("0");
    }
    
    downloadLogs() {
        sendToBackground({ action: 'GET_LOGS' });
    }
    
    saveLogFile(logs) {
        if (!logs || logs.length === 0) {
            alert("No logs to download.");
            return;
        }
        
        const text = logs.map(l => {
            const time = new Date(l.timestamp).toISOString();
            const dataStr = l.data ? ` | Data: ${JSON.stringify(l.data)}` : '';
            return `[${time}] [${l.level}] [${l.context}] ${l.message}${dataStr}`;
        }).join('\n');
        
        // Send to parent to handle download (Sandbox restriction workaround)
        window.parent.postMessage({
            action: 'DOWNLOAD_LOGS',
            payload: {
                text: text,
                filename: `gemini-nexus-logs-${Date.now()}.txt`
            }
        }, '*');
    }

    // --- State Updates (From View or Storage) ---

    setTheme(theme) {
        this.view.applyVisualTheme(theme);
        saveThemeToStorage(theme);
    }
    
    updateTheme(theme) {
        this.view.setThemeValue(theme);
    }
    
    setLanguage(newLang) {
        setLanguagePreference(newLang);
        saveLanguageToStorage(newLang);
        document.dispatchEvent(new CustomEvent('gemini-language-changed'));
    }
    
    updateLanguage(lang) {
        setLanguagePreference(lang);
        this.view.setLanguageValue(lang);
        document.dispatchEvent(new CustomEvent('gemini-language-changed'));
    }

    updateShortcuts(payload) {
        if (payload) {
            this.shortcuts = { ...this.defaultShortcuts, ...payload };
            this.view.setShortcuts(this.shortcuts);
        }
    }
    
    updateTextSelection(enabled) {
        this.textSelectionEnabled = enabled;
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
    }

    updateImageTools(enabled) {
        this.imageToolsEnabled = enabled;
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
    }
    
    updateConnectionSettings(settings) {
        this.connectionData = { ...this.connectionData, ...settings };
        
        // Legacy compat: If provider missing but useOfficialApi is true, set to official
        if (!this.connectionData.provider) {
            if (settings.useOfficialApi) this.connectionData.provider = 'official';
            else this.connectionData.provider = 'web';
        }
        
        this.view.setConnectionSettings(this.connectionData);
    }

    updateAppVersion(version) {
        if (!this.view) return;
        this.view.setAppVersion(version);
    }

    updateSidePanelScope(scope) {
        this.sidePanelScope = scope || 'remembered_tabs';
        this.view.setSidePanelScope(this.sidePanelScope);
    }

    updateContextSettings(settings) {
        this.contextSettings = {
            mode: settings?.mode === 'recent' ? 'recent' : 'summary',
            recentTurns: this.normalizeRecentTurns(settings?.recentTurns)
        };
        this.view.setContextSettings(this.contextSettings);
    }

    normalizeRecentTurns(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return DEFAULT_CONTEXT_RECENT_TURNS;
        return Math.min(50, Math.max(1, parsed));
    }

    updateMcpTestResult(result) {
        if (!this.view || !this.view.connection || typeof this.view.connection.setMcpTestStatus !== 'function') return;

        if (result && result.ok === true) {
            const count = typeof result.toolsCount === 'number' ? result.toolsCount : 0;
            this.view.connection.setMcpTestStatus(`Connected. Tools: ${count}`, false);
            return;
        }

        const err = result && result.error ? result.error : 'Connection failed';
        this.view.connection.setMcpTestStatus(`Failed: ${err}`, true);
    }

    updateMcpToolsResult(result) {
        if (!this.view || !this.view.connection || typeof this.view.connection.setMcpToolsList !== 'function') return;

        if (!result || result.ok !== true) {
            const err = result && result.error ? result.error : 'Failed to fetch tools';
            this.view.connection.setMcpTestStatus(`Failed: ${err}`, true);
            return;
        }

        this.view.connection.setMcpToolsList(
            result.serverId || null,
            result.transport || 'sse',
            result.url || '',
            Array.isArray(result.tools) ? result.tools : []
        );
    }
    
    updateSidebarBehavior(behavior) {
        this.sidebarBehavior = behavior || 'auto';
        this.view.setSidebarBehavior(this.sidebarBehavior);
    }

    updateAccountIndices(indicesString) {
        this.accountIndices = indicesString || "0";
        this.view.setAccountIndices(this.accountIndices);
    }

    async fetchGithubData() {
        if (this.view.hasFetchedStars()) return; 

        try {
            const [starRes, releaseRes] = await Promise.all([
                fetch('https://api.github.com/repos/Maomaoxion/gemini-nexus'),
                fetch('https://api.github.com/repos/Maomaoxion/gemini-nexus/releases/latest')
            ]);

            if (starRes.ok) {
                const data = await starRes.json();
                this.view.displayStars(data.stargazers_count);
            }

            if (releaseRes.ok) {
                const data = await releaseRes.json();
                const latestVersion = data.tag_name; // e.g. "v4.2.0"
                const currentVersion = this.view.getCurrentVersion() || "v0.0.0";
                
                const isNewer = this.compareVersions(latestVersion, currentVersion) > 0;
                this.view.displayUpdateStatus(latestVersion, currentVersion, isNewer);
            }
        } catch (e) {
            console.warn("GitHub fetch failed", e);
            this.view.displayStars(null);
        }
    }

    compareVersions(v1, v2) {
        // Remove 'v' prefix
        const clean1 = v1.replace(/^v/, '');
        const clean2 = v2.replace(/^v/, '');
        
        const parts1 = clean1.split('.').map(Number);
        const parts2 = clean2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }
}
