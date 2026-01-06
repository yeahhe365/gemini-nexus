
// background/handlers/ui.js
import { getActiveTabContent } from './session/utils.js';

export class UIMessageHandler {
    constructor(imageHandler, controlManager, mcpManager) {
        this.imageHandler = imageHandler;
        this.controlManager = controlManager;
        this.mcpManager = mcpManager;
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

        if (request.action === "TOGGLE_SIDE_PANEL_CONTROL") {
            this._handleToggleSidePanelControl(request, sender).finally(() => {
                 sendResponse({ status: "processed" });
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
        
        // --- PAGE CONTEXT CHECK ---
        if (request.action === "CHECK_PAGE_CONTEXT") {
            (async () => {
                const content = await getActiveTabContent();
                const length = content ? content.length : 0;
                sendResponse({ action: "PAGE_CONTEXT_RESULT", length: length });
            })();
            return true;
        }

        // --- MCP (External Tools) ---
        if (request.action === "MCP_TEST_CONNECTION") {
            (async () => {
                try {
                    if (!this.mcpManager) throw new Error("MCP manager not available");
                    const url = (request.url || "").trim();
                    const transport = (request.transport || "sse").toLowerCase();
                    if (!url) throw new Error("Server URL is empty");

                    const tools = await this.mcpManager.listTools({
                        enableMcpTools: true,
                        mcpTransport: transport,
                        mcpServerUrl: url
                    });

                    sendResponse({
                        action: "MCP_TEST_RESULT",
                        ok: true,
                        serverId: request.serverId || null,
                        transport,
                        url,
                        toolsCount: Array.isArray(tools) ? tools.length : 0
                    });
                } catch (e) {
                    sendResponse({
                        action: "MCP_TEST_RESULT",
                        ok: false,
                        serverId: request.serverId || null,
                        transport: request.transport || "sse",
                        url: request.url || "",
                        error: e.message || String(e)
                    });
                }
            })();
            return true;
        }

        if (request.action === "MCP_LIST_TOOLS") {
            (async () => {
                try {
                    if (!this.mcpManager) throw new Error("MCP manager not available");
                    const url = (request.url || "").trim();
                    const transport = (request.transport || "sse").toLowerCase();
                    if (!url) throw new Error("Server URL is empty");

                    const tools = await this.mcpManager.listTools({
                        enableMcpTools: true,
                        mcpTransport: transport,
                        mcpServerUrl: url
                    });

                    // Return only lightweight fields for UI
                    const safeTools = Array.isArray(tools) ? tools.map(t => ({
                        name: t.name,
                        description: t.description || ""
                    })) : [];

                    sendResponse({
                        action: "MCP_TOOLS_RESULT",
                        ok: true,
                        serverId: request.serverId || null,
                        transport,
                        url,
                        tools: safeTools
                    });
                } catch (e) {
                    sendResponse({
                        action: "MCP_TOOLS_RESULT",
                        ok: false,
                        serverId: request.serverId || null,
                        transport: request.transport || "sse",
                        url: request.url || "",
                        error: e.message || String(e),
                        tools: []
                    });
                }
            })();
            return true;
        }
        
        // --- TAB MANAGEMENT ---

        if (request.action === "OPEN_URL_IN_TAB") {
            chrome.tabs.create({ url: request.url }).catch(err => {
                console.error("Failed to open URL:", err);
            });
            sendResponse({ status: "opened" });
            return true;
        }

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

            const updateOps = {};
            if (request.sessionId) updateOps.pendingSessionId = request.sessionId;
            if (request.mode) updateOps.pendingMode = request.mode;

            if (Object.keys(updateOps).length > 0) {
                await chrome.storage.local.set(updateOps);
                // Clear pending items after a timeout to prevent stale actions
                setTimeout(() => {
                    const keys = Object.keys(updateOps);
                    chrome.storage.local.remove(keys);
                }, 5000);
            }

            try { await openPromise; } catch (e) {}

            // If immediate execution needed after open (panel might already be open)
            setTimeout(() => {
                if (request.sessionId) {
                    chrome.runtime.sendMessage({
                        action: "SWITCH_SESSION",
                        sessionId: request.sessionId
                    }).catch(() => {});
                }
                if (request.mode === 'browser_control') {
                    chrome.runtime.sendMessage({
                        action: "ACTIVATE_BROWSER_CONTROL"
                    }).catch(() => {});
                }
            }, 500);
        }
    }

    async _handleToggleSidePanelControl(request, sender) {
        if (!sender.tab) return;
        
        const tabId = sender.tab.id;
        const currentLock = this.controlManager ? this.controlManager.getTargetTabId() : null;
        
        // Is Browser Control active for this tab?
        const isControlActive = (currentLock === tabId);
        
        if (isControlActive) {
            // --- TOGGLE OFF ---
            
            // 1. Disable Control (Detach debugger)
            if (this.controlManager) {
                await this.controlManager.disableControl();
            }
            
            // 2. Close Side Panel (Workaround: disable then enable)
            try {
                // This effectively closes the side panel for this tab
                await chrome.sidePanel.setOptions({ tabId, enabled: false });
                
                // Re-enable it quickly so it can be opened again later
                setTimeout(() => {
                    chrome.sidePanel.setOptions({ tabId, enabled: true, path: 'sidepanel/index.html' });
                }, 250); 
            } catch (e) {
                console.error("Failed to toggle side panel close:", e);
            }
            
        } else {
            // --- TOGGLE ON ---
            await this._handleOpenSidePanel({ ...request, mode: 'browser_control' }, sender);
        }
    }
}
