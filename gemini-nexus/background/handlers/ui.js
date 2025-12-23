
// background/handlers/ui.js

export class UIMessageHandler {
    constructor(imageHandler, controlManager) {
        this.imageHandler = imageHandler;
        this.controlManager = controlManager;
    }

    handle(request, sender, sendResponse) {
        
        // --- IMAGE FETCHING (USER INPUT) ---
        if (request.action === "FETCH_IMAGE") {
            (async () => {
                try {
                    const result = await this.imageHandler.fetchImage(request.url);
                    chrome.runtime.sendMessage(result).catch(() => {});
                } catch (e) {
                    console.error("Fetch image error", e);
                } finally {
                    sendResponse({ status: "completed" });
                }
            })();
            return true;
        }

        // --- IMAGE FETCHING (GENERATED DISPLAY) ---
        if (request.action === "FETCH_GENERATED_IMAGE") {
            (async () => {
                try {
                    const result = await this.imageHandler.fetchImage(request.url);
                    
                    const payload = {
                        action: "GENERATED_IMAGE_RESULT",
                        reqId: request.reqId,
                        base64: result.base64,
                        error: result.error
                    };

                    // Send back to the specific sender (Tab or Extension Page)
                    if (sender.tab) {
                        chrome.tabs.sendMessage(sender.tab.id, payload).catch(() => {});
                    } else {
                        chrome.runtime.sendMessage(payload).catch(() => {});
                    }

                } catch (e) {
                    console.error("Fetch generated image error", e);
                    const payload = {
                        action: "GENERATED_IMAGE_RESULT",
                        reqId: request.reqId,
                        error: e.message
                    };
                    if (sender.tab) {
                        chrome.tabs.sendMessage(sender.tab.id, payload).catch(() => {});
                    } else {
                        chrome.runtime.sendMessage(payload).catch(() => {});
                    }
                } finally {
                    sendResponse({ status: "completed" });
                }
            })();
            return true;
        }

        if (request.action === "CAPTURE_SCREENSHOT") {
            (async () => {
                try {
                    // Determine correct Window ID
                    let windowId = sender.tab ? sender.tab.windowId : null;
                    if (!windowId) {
                        // Fallback: If triggered from sidepanel, find last focused window
                        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                        if (tab) windowId = tab.windowId;
                    }

                    const result = await this.imageHandler.captureScreenshot(windowId);
                    chrome.runtime.sendMessage(result).catch(() => {});
                } catch(e) {
                     console.error("Screenshot error", e);
                } finally {
                    sendResponse({ status: "completed" });
                }
            })();
            return true;
        }

        // --- SIDEPANEL & SELECTION ---

        if (request.action === "OPEN_SIDE_PANEL") {
            this._handleOpenSidePanel(request, sender).finally(() => {
                 sendResponse({ status: "opened" });
            });
            return true; 
        }

        if (request.action === "INITIATE_CAPTURE") {
            (async () => {
                const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (tab) {
                    // Pre-capture for the overlay background
                    // Pass windowId explicitly to capture the correct window
                    const capture = await this.imageHandler.captureScreenshot(tab.windowId);
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "START_SELECTION",
                        image: capture.base64,
                        mode: request.mode, // Forward the mode (ocr, snip, translate)
                        source: request.source // Forward the source (sidepanel or local)
                    }).catch(() => {});
                }
            })();
            return false;
        }

        if (request.action === "AREA_SELECTED") {
            (async () => {
                try {
                    // Use windowId from sender tab to ensure we capture the same window where selection occurred
                    const windowId = sender.tab ? sender.tab.windowId : null;
                    const result = await this.imageHandler.captureArea(request.area, windowId);
                    if (result && sender.tab) {
                         // Send specifically to the tab that initiated the selection
                         chrome.tabs.sendMessage(sender.tab.id, result).catch(() => {});
                    }
                } catch (e) {
                    console.error("Area capture error", e);
                } finally {
                    sendResponse({ status: "completed" });
                }
            })();
            return true;
        }

        if (request.action === "PROCESS_CROP_IN_SIDEPANEL") {
            // Broadcast the crop result to runtime so Side Panel can pick it up
            chrome.runtime.sendMessage(request.payload).catch(() => {});
            sendResponse({ status: "forwarded" });
            return true;
        }

        if (request.action === "GET_ACTIVE_SELECTION") {
            (async () => {
                const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (tab) {
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
                        chrome.runtime.sendMessage({
                            action: "SELECTION_RESULT",
                            text: response ? response.selection : ""
                        }).catch(() => {});
                    } catch (e) {
                        chrome.runtime.sendMessage({ action: "SELECTION_RESULT", text: "" }).catch(() => {});
                    }
                }
                sendResponse({ status: "completed" });
            })();
            return true;
        }
        
        // --- TAB MANAGEMENT ---
        
        if (request.action === "GET_OPEN_TABS") {
            (async () => {
                const tabs = await chrome.tabs.query({ currentWindow: true });
                const safeTabs = tabs.map(t => ({
                    id: t.id,
                    title: t.title,
                    url: t.url,
                    favIconUrl: t.favIconUrl,
                    active: t.active
                }));
                
                // Get the currently locked tab ID to inform UI state
                const lockedTabId = this.controlManager ? this.controlManager.getTargetTabId() : null;

                chrome.runtime.sendMessage({
                    action: "OPEN_TABS_RESULT",
                    tabs: safeTabs,
                    lockedTabId: lockedTabId
                }).catch(() => {});
                sendResponse({ status: "completed" });
            })();
            return true;
        }
        
        if (request.action === "SWITCH_TAB") {
            // tabId can be null to unlock
            if (this.controlManager) {
                this.controlManager.setTargetTab(request.tabId || null);
            }
            // Only switch visual tab if a specific ID is provided AND switchVisual is not explicitly false
            if (request.tabId && request.switchVisual !== false) {
                chrome.tabs.update(request.tabId, { active: true }).catch(err => console.warn(err));
            }
            sendResponse({ status: "switched" });
            return true;
        }

        // --- BROWSER CONTROL TOGGLE ---
        if (request.action === "TOGGLE_BROWSER_CONTROL") {
            if (this.controlManager) {
                if (request.enabled) {
                    this.controlManager.enableControl();
                } else {
                    this.controlManager.disableControl();
                }
            }
            sendResponse({ status: "processed" });
            return true;
        }

        return false;
    }

    async _handleOpenSidePanel(request, sender) {
        if (sender.tab) {
            const openPromise = chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId })
                .catch(err => console.error("Could not open side panel:", err));

            if (request.sessionId) {
                await chrome.storage.local.set({ pendingSessionId: request.sessionId });
                setTimeout(() => chrome.storage.local.remove('pendingSessionId'), 5000);
            }

            try { await openPromise; } catch (e) {}

            if (request.sessionId) {
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: "SWITCH_SESSION",
                        sessionId: request.sessionId
                    }).catch(() => {});
                }, 500);
            }
        }
    }
}
