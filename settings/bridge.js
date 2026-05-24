import {
    DEFAULT_CONTEXT_MODE,
    DEFAULT_CONTEXT_RECENT_TURNS,
    DEFAULT_SHORTCUTS,
    DEFAULT_SIDE_PANEL_SCOPE,
    normalizeContextRecentTurns,
} from '../shared/config/constants.js';
import {
    createConnectionSettingsPayload,
    createConnectionStorageUpdate,
} from '../shared/settings/connection.js';
import { CUSTOM_SELECTION_TOOLS_STORAGE_KEY } from '../shared/settings/selection_tools.js';
import {
    HISTORY_STORAGE_KEYS,
    SETTINGS_STORAGE_KEYS,
    buildDataExportFilename,
    buildHistoryExportPayload,
    buildHistoryImportStorageUpdate,
    buildSettingsExportPayload,
    buildSettingsImportStorageUpdate,
} from '../shared/data_management/index.js';
import { downloadText } from '../sidepanel/core/downloads.js';

function getLocalStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
}

function setLocalStorageData(storageUpdate) {
    chrome.storage.local.set(storageUpdate);
}

function setLocalStorageDataAsync(storageUpdate) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const complete = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        try {
            const writeResult = chrome.storage.local.set(storageUpdate, complete);
            if (writeResult && typeof writeResult.then === 'function') {
                writeResult.then(complete).catch(reject);
            } else if (chrome.storage.local.set.length < 2) {
                queueMicrotask(complete);
            }
        } catch (error) {
            reject(error);
        }
    });
}

function normalizeContextSettings(payload) {
    return {
        mode: payload?.mode === 'recent' ? 'recent' : DEFAULT_CONTEXT_MODE,
        recentTurns: normalizeContextRecentTurns(payload?.recentTurns),
    };
}

export class StandaloneSettingsBridge {
    constructor(controller) {
        this.controller = controller;
        this.handleWindowMessage = this.handleWindowMessage.bind(this);
    }

    init() {
        window.addEventListener('message', this.handleWindowMessage);
    }

    async restoreInitialState() {
        const localStorageData = await getLocalStorageData(SETTINGS_STORAGE_KEYS);
        const shortcuts = { ...DEFAULT_SHORTCUTS, ...(localStorageData.geminiShortcuts || {}) };

        this.controller.updateShortcuts(shortcuts);
        this.controller.updateTheme(
            localStorageData.geminiTheme || localStorage.getItem('geminiTheme') || 'system'
        );
        this.controller.updateLanguage(
            localStorageData.geminiLanguage || localStorage.getItem('geminiLanguage') || 'system'
        );
        this.controller.updateTextSelection(localStorageData.geminiTextSelectionEnabled !== false);
        this.controller.updateTextSelectionBlacklist(
            localStorageData.geminiTextSelectionBlacklist || ''
        );
        this.controller.updateCustomSelectionTools(
            localStorageData[CUSTOM_SELECTION_TOOLS_STORAGE_KEY] || []
        );
        this.controller.updateImageTools(localStorageData.geminiImageToolsEnabled !== false);
        this.controller.updateSidebarBehavior(localStorageData.geminiSidebarBehavior || 'auto');
        this.controller.updateSidePanelScope(
            localStorageData.geminiSidePanelScope || DEFAULT_SIDE_PANEL_SCOPE
        );
        this.controller.updateAccountIndices(localStorageData.geminiAccountIndices || '0');
        this.controller.updateContextSettings({
            mode: localStorageData.geminiContextMode || DEFAULT_CONTEXT_MODE,
            recentTurns: localStorageData.geminiContextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS,
        });
        this.controller.updateConnectionSettings(
            createConnectionSettingsPayload(localStorageData, { includeLegacyFallbacks: true })
        );

        if (chrome.runtime?.getManifest) {
            this.controller.updateAppVersion(`v${chrome.runtime.getManifest().version}`);
        }
        this.controller.fetchGithubData?.();
    }

    handleWindowMessage(event) {
        if (event.source !== window) return;

        const { action, payload } = event.data || {};
        switch (action) {
            case 'FORWARD_TO_BACKGROUND':
                this.forwardToBackground(payload);
                return;
            case 'SAVE_SHORTCUTS':
                setLocalStorageData({ geminiShortcuts: payload || {} });
                return;
            case 'SAVE_THEME':
                localStorage.setItem('geminiTheme', payload || 'system');
                setLocalStorageData({ geminiTheme: payload || 'system' });
                return;
            case 'SAVE_LANGUAGE':
                localStorage.setItem('geminiLanguage', payload || 'system');
                setLocalStorageData({ geminiLanguage: payload || 'system' });
                return;
            case 'SAVE_TEXT_SELECTION':
                setLocalStorageData({ geminiTextSelectionEnabled: payload !== false });
                return;
            case 'SAVE_TEXT_SELECTION_BLACKLIST':
                setLocalStorageData({ geminiTextSelectionBlacklist: payload || '' });
                return;
            case 'SAVE_CUSTOM_SELECTION_TOOLS':
                setLocalStorageData({
                    [CUSTOM_SELECTION_TOOLS_STORAGE_KEY]: Array.isArray(payload) ? payload : [],
                });
                return;
            case 'SAVE_IMAGE_TOOLS':
                setLocalStorageData({ geminiImageToolsEnabled: payload !== false });
                return;
            case 'SAVE_SIDEBAR_BEHAVIOR':
                setLocalStorageData({ geminiSidebarBehavior: payload || 'auto' });
                return;
            case 'SAVE_SIDE_PANEL_SCOPE':
                setLocalStorageData({ geminiSidePanelScope: payload || DEFAULT_SIDE_PANEL_SCOPE });
                return;
            case 'SAVE_ACCOUNT_INDICES':
                setLocalStorageData({ geminiAccountIndices: payload || '0' });
                return;
            case 'SAVE_CONTEXT_SETTINGS':
                {
                    const context = normalizeContextSettings(payload);
                    setLocalStorageData({
                        geminiContextMode: context.mode,
                        geminiContextRecentTurns: context.recentTurns,
                    });
                }
                return;
            case 'SAVE_CONNECTION_SETTINGS':
                setLocalStorageData(createConnectionStorageUpdate(payload));
                return;
            case 'EXPORT_HISTORY_DATA':
                this.exportHistoryData();
                return;
            case 'IMPORT_HISTORY_DATA':
                this.importHistoryData(payload);
                return;
            case 'EXPORT_SETTINGS_DATA':
                this.exportSettingsData();
                return;
            case 'IMPORT_SETTINGS_DATA':
                this.importSettingsData(payload);
                return;
            default:
                return;
        }
    }

    async exportHistoryData() {
        const storageData = await getLocalStorageData(HISTORY_STORAGE_KEYS);
        const payload = buildHistoryExportPayload(storageData);
        downloadText(
            JSON.stringify(payload, null, 2),
            buildDataExportFilename('history'),
            'application/json'
        );
    }

    async exportSettingsData() {
        const storageData = await getLocalStorageData(SETTINGS_STORAGE_KEYS);
        const payload = buildSettingsExportPayload(storageData);
        downloadText(
            JSON.stringify(payload, null, 2),
            buildDataExportFilename('settings'),
            'application/json'
        );
    }

    async importHistoryData(payload) {
        try {
            const currentStorageData = await getLocalStorageData([
                'geminiSessions',
                'geminiGroups',
                'geminiDeletedSessionIds',
            ]);
            const storageUpdate = buildHistoryImportStorageUpdate(payload, currentStorageData);
            await setLocalStorageDataAsync(storageUpdate);
            window.postMessage(
                {
                    action: 'DATA_IMPORT_RESULT',
                    payload: { kind: 'history', ok: true },
                },
                '*'
            );
        } catch (error) {
            this.postImportError('history', error);
        }
    }

    async importSettingsData(payload) {
        try {
            const storageUpdate = buildSettingsImportStorageUpdate(payload);
            await setLocalStorageDataAsync(storageUpdate);
            await this.restoreInitialState();
            window.postMessage(
                {
                    action: 'DATA_IMPORT_RESULT',
                    payload: { kind: 'settings', ok: true },
                },
                '*'
            );
        } catch (error) {
            this.postImportError('settings', error);
        }
    }

    postImportError(kind, error) {
        window.postMessage(
            {
                action: 'DATA_IMPORT_RESULT',
                payload: {
                    kind,
                    ok: false,
                    error: error?.message || null,
                },
            },
            '*'
        );
    }

    async forwardToBackground(payload) {
        if (!payload || !chrome.runtime?.sendMessage) return;

        try {
            const response = await chrome.runtime.sendMessage(payload);
            this.handleBackgroundResponse(response);
        } catch (error) {
            console.warn('Error forwarding settings request:', error);
        }
    }

    handleBackgroundResponse(response) {
        if (!response || typeof response !== 'object') return;

        if (response.action === 'MCP_TEST_RESULT') {
            this.controller.updateMcpTestResult(response);
        } else if (response.action === 'MCP_TOOLS_RESULT') {
            this.controller.updateMcpToolsResult(response);
        } else if (response.logs) {
            this.controller.saveLogFile(response.logs);
        }
    }
}
