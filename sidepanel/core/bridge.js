import {
    DEFAULT_CONTEXT_MODE,
    normalizeContextRecentTurns,
} from '../../shared/config/constants.js';
import {
    CONNECTION_STORAGE_KEYS,
    createConnectionSettingsPayload,
    createConnectionStorageUpdate,
} from '../../shared/settings/connection.js';
import {
    buildHistoryImportStorageUpdate,
    buildSettingsImportStorageUpdate,
} from '../../shared/data_management/index.js';
import {
    mergeSessionSaveWithCurrent,
    normalizeDeletedSessionIds,
    normalizeSessionSavePayload,
} from './session_merge.js';
import { captureDisplayStill } from './screen_capture.js';
import { handleWindowMessageAction } from './window_actions.js';

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

const FORWARDED_RESPONSE_ACTIONS = new Set([
    'GET_LOGS',
    'CHECK_PAGE_CONTEXT',
    'MCP_TEST_CONNECTION',
    'MCP_LIST_TOOLS',
]);

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

        const { action, payload } = event.data || {};
        if (!action) return;

        handleWindowMessageAction(action, payload, this);
    }

    openFullPage() {
        const url = chrome.runtime.getURL('sidepanel/index.html');
        chrome.tabs.create({ url });
    }

    openSettingsPage() {
        this.isRunningInTab()
            .then((isTab) => {
                if (isTab) {
                    this.frame.postMessage({ action: 'OPEN_SETTINGS_MODAL' });
                    return;
                }

                const url = chrome.runtime.getURL('settings/index.html');
                chrome.tabs.create({ url });
            })
            .catch(() => {
                const url = chrome.runtime.getURL('settings/index.html');
                chrome.tabs.create({ url });
            });
    }

    isRunningInTab() {
        return new Promise((resolve) => {
            if (!chrome.tabs || typeof chrome.tabs.getCurrent !== 'function') {
                resolve(false);
                return;
            }

            chrome.tabs.getCurrent((tab) => {
                resolve(Boolean(tab && Number.isInteger(tab.id) && tab.id > 0));
            });
        });
    }

    openExternalUrl(payload) {
        const url = payload?.url;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
            chrome.tabs.create({ url });
        }
    }

    requestScreenCapture() {
        captureDisplayStill()
            .then((payload) => {
                this.postBackgroundMessage(payload);
            })
            .catch((error) => {
                this.postBackgroundMessage({
                    action: 'SCREEN_CAPTURE_ERROR',
                    error: error?.message || 'Screen capture failed',
                });
            });
    }

    forwardToBackground(payload) {
        const scopedPayload = this._attachCurrentTabContext(payload);
        chrome.runtime
            .sendMessage(scopedPayload)
            .then((response) => {
                if (response && FORWARDED_RESPONSE_ACTIONS.has(scopedPayload.action)) {
                    this.postBackgroundMessage(response);
                }
            })
            .catch((error) => console.warn('Error forwarding to background:', error));
    }

    restoreConnectionSettings() {
        chrome.storage.local.get(CONNECTION_STORAGE_KEYS, (result) => {
            this.frame.postMessage({
                action: 'RESTORE_CONNECTION_SETTINGS',
                payload: createConnectionSettingsPayload(result, { includeLegacyFallbacks: true }),
            });
        });
    }

    restoreSidebarExpanded() {
        chrome.storage.local.get(['geminiSidebarExpanded'], (result) => {
            this.frame.postMessage({
                action: 'RESTORE_SIDEBAR_EXPANDED',
                payload: result.geminiSidebarExpanded !== false,
            });
        });
    }

    saveSidebarExpanded(payload) {
        this.state.save('geminiSidebarExpanded', payload !== false);
    }

    saveSelectedModel(payload) {
        const model = getModelSaveValue(payload);
        if (typeof model === 'string' && model.trim()) {
            this.state.save(getModelSaveKey(payload), model);
        }
    }

    saveSidePanelSessionBinding(payload) {
        const tabId = payload?.tabId;
        const sessionId = payload?.sessionId || null;
        if (!Number.isInteger(tabId) || tabId <= 0) return;

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

    saveContextSettings(payload) {
        this.state.save(
            'geminiContextMode',
            payload?.mode === 'recent' ? 'recent' : DEFAULT_CONTEXT_MODE
        );
        this.state.save(
            'geminiContextRecentTurns',
            normalizeContextRecentTurns(payload?.recentTurns)
        );
    }

    saveConnectionSettings(payload) {
        const storageUpdate = createConnectionStorageUpdate(payload);
        for (const [key, value] of Object.entries(storageUpdate)) {
            this.state.save(key, value);
        }
    }

    importHistoryData(payload) {
        chrome.storage.local.get(
            ['geminiSessions', 'geminiGroups', 'geminiDeletedSessionIds'],
            (result) => {
                try {
                    const storageUpdate = buildHistoryImportStorageUpdate(payload, result || {});
                    chrome.storage.local.set(storageUpdate, () => {
                        this.postDataImportResult('history', true);
                    });
                } catch (error) {
                    this.postDataImportResult('history', false, error);
                }
            }
        );
    }

    importSettingsData(payload) {
        try {
            const storageUpdate = buildSettingsImportStorageUpdate(payload);
            chrome.storage.local.set(storageUpdate, () => {
                this.postDataImportResult('settings', true);
            });
        } catch (error) {
            this.postDataImportResult('settings', false, error);
        }
    }

    postDataImportResult(kind, ok, error = null) {
        this.frame.postMessage({
            action: 'DATA_IMPORT_RESULT',
            payload: {
                kind,
                ok,
                error: error?.message || null,
            },
        });
    }

    postBackgroundMessage(payload) {
        this.frame.postMessage({
            action: 'BACKGROUND_MESSAGE',
            payload,
        });
    }

    saveSessionsSafely(payload) {
        const { sessions, mutation } = normalizeSessionSavePayload(payload);
        if (!Array.isArray(sessions)) {
            this.state.save('geminiSessions', sessions);
            return;
        }

        chrome.storage.local.get(['geminiSessions', 'geminiDeletedSessionIds'], (result) => {
            const deletedSessionIds = normalizeDeletedSessionIds(result?.geminiDeletedSessionIds);
            if (mutation?.type === 'deleteSession' && mutation.sessionId) {
                deletedSessionIds[mutation.sessionId] = Date.now();
            }

            const merged = mergeSessionSaveWithCurrent(
                sessions,
                result?.geminiSessions,
                mutation,
                deletedSessionIds
            );
            this.state.save('geminiSessions', merged);
            chrome.storage.local.set({ geminiDeletedSessionIds: deletedSessionIds });
        });
    }

    handleRuntimeMessage(message) {
        if (!this._isMessageForCurrentTab(message)) return;

        if (message.action === 'SESSIONS_UPDATED') {
            this.state.updateSessions(message.sessions);
            this.frame.postMessage({
                action: 'RESTORE_SESSIONS',
                payload: message.sessions,
            });
            return;
        }

        this.frame.postMessage({
            action: 'BACKGROUND_MESSAGE',
            payload: message,
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
            sidePanelTabId: currentTabId,
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
