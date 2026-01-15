
// background/index.js
import { GeminiSessionManager } from './managers/session_manager.js';
import { ImageManager } from './managers/image_manager.js';
import { BrowserControlManager } from './managers/control_manager.js';
import { McpRemoteManager } from './managers/mcp_remote_manager.js';
import { LogManager, setupConsoleInterception } from './managers/log_manager.js';
import { setupContextMenus } from './menus.js';
import { setupMessageListener } from './messages.js';
import { keepAliveManager } from './managers/keep_alive.js';

// Setup Sidepanel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Initialize LogManager
const logManager = new LogManager();

// Setup Console Interception (Captures logs for UI download)
setupConsoleInterception(logManager);

console.info("[Gemini Nexus] Background Service Worker Started");

// Initialize Managers
const sessionManager = new GeminiSessionManager();
const imageManager = new ImageManager();
const controlManager = new BrowserControlManager();
const mcpManager = new McpRemoteManager({
    clientName: 'gemini-nexus',
    clientVersion: chrome.runtime.getManifest().version
});

// Initialize Modules
setupContextMenus(imageManager);
setupMessageListener(sessionManager, imageManager, controlManager, mcpManager, logManager);

// Setup Command Listener for global shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    console.log('[Background] Command received:', command);

    if (command === 'toggle_pip_window') {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id) {
            console.warn('[Background] No active tab found');
            return;
        }

        console.log('[Background] Active tab:', tab.id, tab.url);

        // First check if PIP window actually exists
        chrome.tabs.sendMessage(tab.id, { action: 'PIP_CHECK' })
            .then(checkResponse => {
                console.log('[Background] PIP check response:', checkResponse);

                if (checkResponse && checkResponse.exists) {
                    // PIP window exists: Alt+G acts as a true toggle (close/open).
                    // Programmatic resize/minimize of Document Picture-in-Picture windows can be blocked
                    // without user activation in the PiP document (e.g. consecutive Alt+G).
                    console.log('[Background] PIP exists, closing window');
                    chrome.tabs.sendMessage(tab.id, { action: 'PIP_CLOSE' })
                        .then(response => console.log('[Background] Toggle response:', response))
                        .catch(error => console.error('[Background] Toggle failed:', error));
                } else {
                    // PIP window doesn't exist, create it
                    console.log('[Background] PIP does not exist, creating new window');
                    chrome.tabs.sendMessage(tab.id, { action: 'PIP_CREATE' })
                        .then(response => {
                            console.log('[Background] Create response:', response);
                            if (response && !response.success) {
                                console.error('[Background] PIP creation error:', response.error);
                            }
                        })
                        .catch(error => {
                            console.error('[Background] Failed to send PIP_CREATE:', error);
                            console.error('[Background] Content script may not be loaded on:', tab.url);
                        });
                }
            })
            .catch(error => {
                // If PIP_CHECK fails, content script is not loaded
                console.error('[Background] Failed to check PIP status:', error);
                console.error('[Background] Content script is not loaded on this page');
                console.error('[Background] Tab URL:', tab.url);
            });
    }
});

// Initialize Advanced Keep-Alive (Cookie Rotation)
keepAliveManager.init();
