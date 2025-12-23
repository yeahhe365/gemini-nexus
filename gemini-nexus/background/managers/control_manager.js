
// background/managers/control_manager.js
import { BrowserConnection } from '../control/connection.js';
import { SnapshotManager } from '../control/snapshot.js';
import { BrowserActions } from '../control/actions.js';
import { ToolDispatcher } from '../control/dispatcher.js';

/**
 * Main Controller handling Chrome DevTools MCP functionalities.
 * Orchestrates connection, snapshots, and action execution.
 */
export class BrowserControlManager {
    constructor() {
        this.connection = new BrowserConnection();
        this.snapshotManager = new SnapshotManager(this.connection);
        this.actions = new BrowserActions(this.connection, this.snapshotManager);
        this.dispatcher = new ToolDispatcher(this.actions, this.snapshotManager);
        this.lockedTabId = null;

        // Listen for updates to the locked tab (URL/Favicon changes)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (tabId === this.lockedTabId) {
                // If the update contains relevant info, broadcast it
                if (changeInfo.favIconUrl || changeInfo.title || changeInfo.url) {
                    this._broadcastLockState(tab);
                }
            }
        });

        // Listen for closure of the locked tab
        chrome.tabs.onRemoved.addListener((tabId) => {
            if (tabId === this.lockedTabId) {
                this.setTargetTab(null);
            }
        });
    }

    setTargetTab(tabId) {
        this.lockedTabId = tabId;
        console.log(`[ControlManager] Target tab locked to: ${tabId}`);
        
        if (tabId) {
            // Fetch tab info to broadcast state immediately
            chrome.tabs.get(tabId).then(tab => {
                this._broadcastLockState(tab);
            }).catch(() => {
                // Tab might have closed or invalid ID
                this.lockedTabId = null;
                this._broadcastLockState(null);
            });
        } else {
            this._broadcastLockState(null);
        }
    }

    _broadcastLockState(tab) {
        chrome.runtime.sendMessage({
            action: "TAB_LOCKED",
            tab: tab ? {
                id: tab.id,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                url: tab.url,
                active: tab.active
            } : null
        }).catch(() => {});
    }

    getTargetTabId() {
        return this.lockedTabId;
    }

    // --- Control Lifecycle ---

    async enableControl() {
        // If already connected, do nothing (or verify tab)
        if (this.connection.attached && this.lockedTabId === this.connection.currentTabId) {
            return true;
        }

        // Auto-lock to active tab if not currently locked
        if (!this.lockedTabId) {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (tab) {
                this.setTargetTab(tab.id);
            }
        }
        
        // Force attachment which shows the "Started debugging" bar
        return await this.ensureConnection();
    }

    async disableControl() {
        // Clear lock
        this.setTargetTab(null);
        // Detach debugger which hides the bar
        if (this.connection.attached) {
            await this.connection.detach();
        }
    }

    // --- Internal Helpers ---

    async ensureConnection() {
        let tabId = this.lockedTabId;
        
        if (tabId) {
            // Verify if locked tab still exists
            try {
                await chrome.tabs.get(tabId);
            } catch (e) {
                console.warn("[ControlManager] Locked tab not found, clearing lock.", e);
                this.lockedTabId = null;
                tabId = null;
            }
        }

        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (!tab) return false;
            tabId = tab.id;
        }
        
        // Perform quick check on URL before attaching
        let tabObj;
        try {
            tabObj = await chrome.tabs.get(tabId);
        } catch(e) { return false; }

        // Robust check for restricted URLs to avoid "Debugger attach failed" warnings
        // Check both url and pendingUrl (for mid-navigation states)
        const urlRaw = tabObj.url || tabObj.pendingUrl || "";
        
        // If no URL is returned (e.g. system page without permissions), skip
        if (!urlRaw) return false;

        const url = urlRaw.toLowerCase();
        const isRestricted = url.startsWith('chrome://') || 
                             url.startsWith('edge://') || 
                             url.startsWith('about:') || 
                             url.startsWith('chrome-extension://') ||
                             url.startsWith('https://chromewebstore.google.com') ||
                             url.startsWith('https://chrome.google.com/webstore') ||
                             url.startsWith('view-source:');

        if (isRestricted) {
            // Fail silently for restricted pages to avoid log noise
            return false;
        }

        await this.connection.attach(tabId);
        return true;
    }

    async getSnapshot() {
        if (!this.connection.attached) {
             const success = await this.ensureConnection();
             // Check connection.attached explicitly.
             if (!success || !this.connection.attached) return null;
        }
        return await this.snapshotManager.takeSnapshot();
    }

    // --- Execution Entry Point ---

    async execute(toolCall) {
        try {
            const { name, args } = toolCall;
            const success = await this.ensureConnection();
            
            // Check attached status as well to be safe
            if (!success || !this.connection.attached) {
                return "Error: No active tab found, restricted URL, or debugger disconnected.";
            }

            console.log(`[MCP] Executing tool: ${name}`, args);

            // Delegate to dispatcher
            const result = await this.dispatcher.dispatch(name, args);

            let finalOutput = result;

            // Handle metadata objects returned by tools (e.g. NavigationActions)
            if (result && typeof result === 'object') {
                
                // 1. Process State Updates
                if (result._meta && result._meta.switchTabId) {
                    this.setTargetTab(result._meta.switchTabId);
                }

                // 2. Unwrap Output
                // If it has an 'output' property (standardized wrapper), return that string.
                // Otherwise return the object as is (e.g. screenshot { text, image }).
                if ('output' in result) {
                    finalOutput = result.output;
                }
            }

            return finalOutput;

        } catch (e) {
            console.error(`[MCP] Tool execution error:`, e);
            return `Error executing ${toolCall.name}: ${e.message}`;
        }
    }
}
