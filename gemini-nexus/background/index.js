
// background/index.js
import { GeminiSessionManager } from './managers/session_manager.js';
import { ImageManager } from './managers/image_manager.js';
import { BrowserControlManager } from './managers/control_manager.js';
import { McpRemoteManager } from './managers/mcp_remote_manager.js';
import { LogManager, setupConsoleInterception } from './managers/log_manager.js';
import { SidePanelScopeManager } from './managers/sidepanel_scope_manager.js';
import { setupContextMenus } from './menus.js';
import { setupMessageListener } from './messages.js';
import { keepAliveManager } from './managers/keep_alive.js';

// Initialize LogManager
const logManager = new LogManager();

// Setup Console Interception (Captures logs for UI download)
setupConsoleInterception(logManager);

console.info("[Gemini Nexus] Background Service Worker Started");

// Initialize Managers
const sessionManager = new GeminiSessionManager();
const imageManager = new ImageManager();
const controlManager = new BrowserControlManager();
const sidePanelScopeManager = new SidePanelScopeManager();
const mcpManager = new McpRemoteManager({
    clientName: 'gemini-nexus',
    clientVersion: chrome.runtime.getManifest().version
});

// Setup Sidepanel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
sidePanelScopeManager.init();
chrome.action.onClicked.addListener((tab) => {
    if (!tab?.id || !tab.windowId) return;
    sidePanelScopeManager.openForTab(tab.id, tab.windowId).catch((error) => {
        console.error('Could not open side panel from action click:', error);
    });
});

// Initialize Modules
setupContextMenus(imageManager);
setupMessageListener(sessionManager, imageManager, controlManager, mcpManager, logManager, sidePanelScopeManager);

// Initialize Advanced Keep-Alive (Cookie Rotation)
keepAliveManager.init();
