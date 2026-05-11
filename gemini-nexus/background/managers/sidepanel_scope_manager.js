// background/managers/sidepanel_scope_manager.js

const DEFAULT_PANEL_PATH = 'sidepanel/index.html';
const DEFAULT_SCOPE = 'remembered_tabs';

export function getPanelPathForTab(tabId) {
    const normalizedTabId = Number(tabId);
    if (!Number.isInteger(normalizedTabId) || normalizedTabId <= 0) {
        return DEFAULT_PANEL_PATH;
    }

    return `${DEFAULT_PANEL_PATH}?tabId=${normalizedTabId}`;
}

export class SidePanelScopeManager {
    constructor() {
        this.scope = DEFAULT_SCOPE;
        this.enabledTabs = {};
    }

    init() {
        (async () => {
            const [localState, sessionState] = await Promise.all([
                chrome.storage.local.get([
                    'geminiSidePanelScope',
                    'geminiSidePanelEnabledTabs'
                ]),
                chrome.storage.session.get(['geminiSidePanelEnabledTabs'])
            ]);

            const normalizedScope = this.normalizeScope(localState.geminiSidePanelScope);
            this.scope = normalizedScope;
            this.enabledTabs = this.normalizeEnabledTabs(sessionState.geminiSidePanelEnabledTabs);

            if (localState.geminiSidePanelScope !== normalizedScope) {
                await chrome.storage.local.set({ geminiSidePanelScope: normalizedScope });
            }

            if (localState.geminiSidePanelEnabledTabs) {
                await chrome.storage.local.remove('geminiSidePanelEnabledTabs');
            }

            await this.refreshDefaultOptions();
            await this.refreshAllTabs();
        })().catch((error) => {
            console.warn('[SidePanelScopeManager] Failed to initialize scope state:', error);
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            let needsRefresh = false;

            if (areaName === 'local' && changes.geminiSidePanelScope) {
                const normalizedScope = this.normalizeScope(changes.geminiSidePanelScope.newValue);
                if (changes.geminiSidePanelScope.newValue !== normalizedScope) {
                    chrome.storage.local.set({ geminiSidePanelScope: normalizedScope }).catch((error) => {
                        console.warn('[SidePanelScopeManager] Failed to migrate legacy scope:', error);
                    });
                }
                this.scope = normalizedScope;
                needsRefresh = true;
            }

            if (areaName === 'session' && changes.geminiSidePanelEnabledTabs) {
                this.enabledTabs = this.normalizeEnabledTabs(changes.geminiSidePanelEnabledTabs.newValue);
                needsRefresh = true;
            }

            if (needsRefresh) {
                this.refreshDefaultOptions()
                    .then(() => this.refreshAllTabs())
                    .catch((error) => console.warn('[SidePanelScopeManager] Failed to refresh scope state:', error));
            }
        });

        chrome.tabs.onRemoved.addListener((tabId) => {
            if (this.enabledTabs[tabId]) {
                delete this.enabledTabs[tabId];
                this.persistEnabledTabs().catch((error) => {
                    console.warn('[SidePanelScopeManager] Failed to persist removed tab state:', error);
                });
            }
        });
    }

    normalizeScope(scope) {
        if (scope === 'global' || scope === 'remembered_tabs') {
            return scope;
        }
        return DEFAULT_SCOPE;
    }

    normalizeEnabledTabs(value) {
        if (!value || typeof value !== 'object') return {};

        const normalized = {};
        for (const [key, enabled] of Object.entries(value)) {
            if (enabled !== true) continue;
            const tabId = Number(key);
            if (Number.isInteger(tabId) && tabId > 0) {
                normalized[tabId] = true;
            }
        }
        return normalized;
    }

    async persistEnabledTabs() {
        await chrome.storage.session.set({ geminiSidePanelEnabledTabs: this.enabledTabs });
    }

    async refreshAllTabs() {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map((tab) => this.applyToTab(tab.id)));
    }

    async refreshDefaultOptions() {
        await chrome.sidePanel.setOptions({
            path: DEFAULT_PANEL_PATH,
            enabled: this.scope === 'global'
        });
    }

    isEnabledForTab(tabId) {
        if (!tabId) return false;
        if (this.scope === 'global') return true;
        return this.enabledTabs[tabId] === true;
    }

    async applyToTab(tabId) {
        if (!tabId) return;

        const enabled = this.isEnabledForTab(tabId);
        await chrome.sidePanel.setOptions({
            tabId,
            path: getPanelPathForTab(tabId),
            enabled
        });
    }

    async openForTab(tabId, windowId) {
        if (!tabId || !windowId) return;

        if (this.scope === 'remembered_tabs') {
            const disableDefaultPromise = chrome.sidePanel.setOptions({
                path: DEFAULT_PANEL_PATH,
                enabled: false
            }).catch(() => {});

            const enableTabPromise = chrome.sidePanel.setOptions({
                tabId,
                path: getPanelPathForTab(tabId),
                enabled: true
            }).catch((error) => {
                console.warn('[SidePanelScopeManager] Failed to enable remembered side panel:', error);
            });

            const openPromise = chrome.sidePanel.open({ tabId, windowId });

            if (!this.enabledTabs[tabId]) {
                this.enabledTabs[tabId] = true;
                await this.persistEnabledTabs();
            }

            await Promise.all([disableDefaultPromise, enableTabPromise, openPromise]);
        } else {
            const defaultOptionsPromise = Promise.all([
                this.refreshDefaultOptions(),
                chrome.sidePanel.setOptions({
                    tabId,
                    path: getPanelPathForTab(tabId),
                    enabled: true
                })
            ]);
            const openPromise = chrome.sidePanel.open({ tabId, windowId });
            await Promise.all([defaultOptionsPromise, openPromise]);
        }
    }
}
