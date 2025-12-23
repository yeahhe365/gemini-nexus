
// background/control/connection.js
import { CollectorManager } from './collectors.js';

/**
 * Manages the connection to the Chrome Debugger API.
 */
export class BrowserConnection {
    constructor() {
        this.currentTabId = null;
        this.targetTabId = null; // Tracks the intended tab ID even if debugger is not attached
        this.attached = false;
        this.onDetachCallbacks = [];
        this.eventListeners = new Set();
        
        // Tracing State
        this.traceEvents = [];
        this.traceCompletePromise = null;
        this.traceCompleteResolver = null;

        // Initialize State Collectors
        this.collectors = new CollectorManager();

        // Global listener for CDP events
        chrome.debugger.onEvent.addListener(this._handleEvent.bind(this));
    }

    _handleEvent(source, method, params) {
        if (this.attached && this.currentTabId === source.tabId) {
            // 0. Handle Tracing Events (Special Case)
            if (method === 'Tracing.dataCollected') {
                this.traceEvents.push(...params.value);
            } else if (method === 'Tracing.tracingComplete') {
                if (this.traceCompleteResolver) {
                    this.traceCompleteResolver(this.traceEvents);
                    this.traceCompleteResolver = null;
                }
            }

            // 1. Pass to collectors for persistence
            this.collectors.handleEvent(method, params);
            
            // 2. Pass to active listeners (e.g. WaitHelper)
            this.eventListeners.forEach(callback => callback(method, params));
        }
    }

    addListener(callback) {
        this.eventListeners.add(callback);
    }

    removeListener(callback) {
        this.eventListeners.delete(callback);
    }

    onDetach(callback) {
        this.onDetachCallbacks.push(callback);
    }

    async attach(tabId) {
        this.targetTabId = tabId; // Always store the intended tab

        // If already attached to the same tab, just ensure domains are enabled
        if (this.attached && this.currentTabId === tabId) {
            return;
        }
        
        // If attached to a different tab, detach first
        if (this.attached && this.currentTabId !== tabId) {
            await this.detach();
        }

        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, "1.3", async () => {
                if (chrome.runtime.lastError) {
                    const msg = chrome.runtime.lastError.message;
                    // Suppress common expected errors for restricted targets to avoid log noise
                    if (msg.includes("restricted URL") || msg.includes("Cannot access") || msg.includes("Attach to webui")) {
                        console.debug("[BrowserConnection] Attach skipped (restricted):", msg);
                    } else {
                        console.warn("[BrowserConnection] Attach failed:", msg);
                    }
                    // Resolve anyway to allow fallback actions (like navigation) to proceed without debugger
                    resolve();
                } else {
                    this.attached = true;
                    this.currentTabId = tabId;
                    
                    // Clear collectors on new attachment (new session)
                    this.collectors.clear();
                    // Clear trace buffer
                    this.traceEvents = [];

                    // Enable domains for collection
                    try {
                        await this.sendCommand("Network.enable");
                        await this.sendCommand("Log.enable");
                        await this.sendCommand("Runtime.enable");
                        // Page domain is often enabled by actions, but good to have for lifecycle
                        // Also enables Page.javascriptDialogOpening events
                        await this.sendCommand("Page.enable");
                        // Enable Audits for issues (CORS, mixed content, etc)
                        await this.sendCommand("Audits.enable");
                    } catch (e) {
                        console.warn("Failed to enable collection domains:", e);
                    }

                    resolve();
                }
            });
        });
    }

    async detach() {
        if (!this.attached || !this.currentTabId) return;
        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId: this.currentTabId }, () => {
                this.attached = false;
                this.currentTabId = null;
                this.traceEvents = [];
                this.onDetachCallbacks.forEach(cb => cb());
                resolve();
            });
        });
    }

    sendCommand(method, params = {}) {
        if (!this.currentTabId) throw new Error("No active debugger session");
        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId: this.currentTabId }, method, params, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async startTracing(categories) {
        this.traceEvents = [];
        await this.sendCommand('Tracing.start', { categories });
    }

    async stopTracing() {
        this.traceCompletePromise = new Promise(resolve => {
            this.traceCompleteResolver = resolve;
        });
        await this.sendCommand('Tracing.end');
        return this.traceCompletePromise;
    }
}
