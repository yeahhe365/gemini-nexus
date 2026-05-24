import { CONNECTION_STORAGE_KEYS } from '../../shared/settings/connection.js';
import {
    createInitialRestoreMessages,
    createLocalStorageRestoreMessages,
} from './state_messages.js';

export function getOwnerTabIdFromLocation(locationLike = window.location) {
    try {
        const url = new URL(locationLike.href);
        const tabId = Number.parseInt(url.searchParams.get('tabId'), 10);
        return Number.isInteger(tabId) && tabId > 0 ? tabId : null;
    } catch {
        return null;
    }
}

function cacheSidebarExpandedPreference(isExpanded) {
    localStorage.setItem('geminiSidebarExpanded', isExpanded === false ? 'false' : 'true');
}

export class StateManager {
    constructor(frameManager) {
        this.frame = frameManager;
        this.localStorageData = null;
        this.sessionStorageData = null;
        this.ownerTabId = getOwnerTabIdFromLocation();
        this.currentTabId = this.ownerTabId ?? undefined;
        this.uiIsReady = false;
        this.hasInitialized = false;
    }

    init() {
        chrome.storage.local.get(
            [
                'geminiSessions',
                'geminiGroups',
                'pendingSessionId',
                'pendingMode',
                'geminiShortcuts',
                'pendingImage',
                'geminiSidebarBehavior',
                'geminiSidebarExpanded',
                'geminiSidePanelScope',
                'geminiTextSelectionEnabled',
                'geminiTextSelectionBlacklist',
                'geminiImageToolsEnabled',
                'geminiAccountIndices',
                ...CONNECTION_STORAGE_KEYS,
                'geminiContextMode',
                'geminiContextRecentTurns',
            ],
            (result) => {
                this.localStorageData = result;
                this.trySendInitData();
            }
        );

        chrome.storage.session.get(['geminiSidePanelSessionBindings'], (result) => {
            this.sessionStorageData = result;
            this.trySendInitData();
        });

        if (this.hasFixedTabContext()) {
            this.trySendInitData();
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                this.currentTabId = tabs && tabs[0] ? tabs[0].id : null;
                this.trySendInitData();
            });
        }

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'session' && changes.geminiSidePanelSessionBindings) {
                this.sessionStorageData = {
                    geminiSidePanelSessionBindings:
                        changes.geminiSidePanelSessionBindings.newValue || {},
                };
                this.postCurrentTabContext();
                return;
            }

            if (areaName === 'local') {
                this.syncLocalStorageChanges(changes);
            }
        });

        chrome.tabs.onActivated.addListener(({ tabId }) => {
            if (this.hasFixedTabContext()) return;

            this.currentTabId = tabId || null;
            this.postCurrentTabContext();
        });

        chrome.tabs.onRemoved.addListener((tabId) => {
            this.removeSessionBinding(tabId);

            if (this.ownerTabId === tabId) {
                this.currentTabId = null;
                this.postCurrentTabContext();
                return;
            }

            if (this.hasFixedTabContext()) return;

            if (this.currentTabId === tabId) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    this.currentTabId = tabs && tabs[0] ? tabs[0].id : null;
                    this.postCurrentTabContext();
                });
            }
        });

        setTimeout(() => {
            if (!this.uiIsReady) {
                console.warn('UI_READY signal timeout, forcing skeleton removal');
                this.frame.reveal();
            }
        }, 1000);
    }

    markUiReady() {
        this.uiIsReady = true;
        this.trySendInitData();
    }

    trySendInitData() {
        if (
            (!this.uiIsReady && !this.hasInitialized) ||
            !this.localStorageData ||
            this.sessionStorageData === null ||
            this.currentTabId === undefined
        )
            return;

        this.hasInitialized = true;
        this.frame.reveal();

        const frameWindow = this.frame.getWindow();
        if (!frameWindow) return;

        const restoreMessages = createInitialRestoreMessages(this.localStorageData, {
            theme: localStorage.getItem('geminiTheme') || 'system',
            language: localStorage.getItem('geminiLanguage') || 'system',
            appVersion: `v${chrome.runtime.getManifest().version}`,
        });
        cacheSidebarExpandedPreference(this.localStorageData.geminiSidebarExpanded);

        restoreMessages.beforeTabContext.forEach((message) => this.frame.postMessage(message));
        this.postCurrentTabContext();
        restoreMessages.afterTabContext.forEach((message) => this.frame.postMessage(message));

        // Replay deferred actions captured before the side panel was ready.
        if (this.localStorageData.pendingSessionId) {
            this.frame.postMessage({
                action: 'BACKGROUND_MESSAGE',
                payload: {
                    action: 'SWITCH_SESSION',
                    sessionId: this.localStorageData.pendingSessionId,
                },
            });
            chrome.storage.local.remove('pendingSessionId');
            delete this.localStorageData.pendingSessionId;
        }

        if (this.localStorageData.pendingImage) {
            this.frame.postMessage({
                action: 'BACKGROUND_MESSAGE',
                payload: this.localStorageData.pendingImage,
            });
            chrome.storage.local.remove('pendingImage');
            delete this.localStorageData.pendingImage;
        }

        if (this.localStorageData.pendingMode === 'browser_control') {
            this.frame.postMessage({
                action: 'BACKGROUND_MESSAGE',
                payload: { action: 'ACTIVATE_BROWSER_CONTROL' },
            });
            chrome.storage.local.remove('pendingMode');
            delete this.localStorageData.pendingMode;
        }

        restoreMessages.afterPendingActions.forEach((message) => this.frame.postMessage(message));
    }

    syncLocalStorageChanges(changes) {
        if (!this.localStorageData) return;

        const changedKeys = Object.keys(changes);
        for (const key of changedKeys) {
            const newValue = changes[key].newValue;
            if (newValue === undefined) delete this.localStorageData[key];
            else this.localStorageData[key] = newValue;
        }

        if (!this.hasInitialized) return;

        if (Object.prototype.hasOwnProperty.call(changes, 'geminiTheme')) {
            localStorage.setItem('geminiTheme', this.localStorageData.geminiTheme || 'system');
        }
        if (Object.prototype.hasOwnProperty.call(changes, 'geminiLanguage')) {
            localStorage.setItem(
                'geminiLanguage',
                this.localStorageData.geminiLanguage || 'system'
            );
        }
        if (Object.prototype.hasOwnProperty.call(changes, 'geminiSidebarExpanded')) {
            cacheSidebarExpandedPreference(this.localStorageData.geminiSidebarExpanded);
        }

        createLocalStorageRestoreMessages(this.localStorageData, changedKeys).forEach((message) =>
            this.frame.postMessage(message)
        );
    }

    updateSessions(sessions) {
        if (this.localStorageData) this.localStorageData.geminiSessions = sessions;
    }

    save(key, value) {
        if (this.localStorageData) this.localStorageData[key] = value;

        const update = {};
        update[key] = value;
        chrome.storage.local.set(update);

        if (key === 'geminiTheme') localStorage.setItem('geminiTheme', value);
        if (key === 'geminiLanguage') localStorage.setItem('geminiLanguage', value);
        if (key === 'geminiSidebarExpanded') cacheSidebarExpandedPreference(value);
    }

    getCurrentTabId() {
        return this.currentTabId;
    }

    hasFixedTabContext() {
        return Number.isInteger(this.ownerTabId) && this.ownerTabId > 0;
    }

    getSessionBindings() {
        return this.sessionStorageData?.geminiSidePanelSessionBindings || {};
    }

    postCurrentTabContext() {
        if (!this.hasInitialized) return;
        if (!this.frame.getWindow()) return;

        const sessionBindings = this.getSessionBindings();
        const boundSessionId = this.currentTabId
            ? sessionBindings[this.currentTabId] || null
            : null;

        this.frame.postMessage({
            action: 'RESTORE_SIDE_PANEL_TAB_CONTEXT',
            payload: {
                tabId: this.currentTabId,
                sessionId: boundSessionId,
            },
        });
    }

    removeSessionBinding(tabId) {
        if (!Number.isInteger(tabId) || tabId <= 0) return;

        const sessionBindings = this.getSessionBindings();
        if (!Object.prototype.hasOwnProperty.call(sessionBindings, tabId)) return;

        const nextBindings = { ...sessionBindings };
        delete nextBindings[tabId];
        this.sessionStorageData = { geminiSidePanelSessionBindings: nextBindings };
        chrome.storage.session.set({ geminiSidePanelSessionBindings: nextBindings });
    }
}
