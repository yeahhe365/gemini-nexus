
// content.js v4.2.3 -> content/index.js

console.log("%c Gemini Nexus v4.2.3 Ready ", "background: #333; color: #00ff00; font-size: 16px");

(function() {
    // Dependencies (Loaded via manifest order)
    const shortcuts = window.GeminiShortcuts;
    const router = window.GeminiMessageRouter;
    const Overlay = window.GeminiNexusOverlay;
    const Controller = window.GeminiToolbarController;
    const Pip = window.GeminiPip;

    // Initialize Helpers
    const selectionOverlay = new Overlay();
    const floatingToolbar = new Controller();

    // Initialize Router
    router.init(floatingToolbar, selectionOverlay);

    // Link Shortcuts
    shortcuts.setController(floatingToolbar);

    // Setup PIP message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action && message.action.startsWith('PIP_')) {
            if (Pip && Pip.handle) {
                Pip.handle(message).then(response => {
                    sendResponse(response);
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Will respond asynchronously
            } else {
                sendResponse({ success: false, error: 'PIP module not available' });
            }
        }
    });

    // Handle initial settings that don't fit in dedicated modules yet
    chrome.storage.local.get(['geminiTextSelectionEnabled', 'geminiImageToolsEnabled'], (result) => {
        const selectionEnabled = result.geminiTextSelectionEnabled !== false;
        if (floatingToolbar) {
            floatingToolbar.setSelectionEnabled(selectionEnabled);
        }

        const imageToolsEnabled = result.geminiImageToolsEnabled !== false;
        if (floatingToolbar) {
            floatingToolbar.setImageToolsEnabled(imageToolsEnabled);
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.geminiTextSelectionEnabled) {
                 const enabled = changes.geminiTextSelectionEnabled.newValue !== false;
                 if (floatingToolbar) floatingToolbar.setSelectionEnabled(enabled);
            }
            if (changes.geminiImageToolsEnabled) {
                 const enabled = changes.geminiImageToolsEnabled.newValue !== false;
                 if (floatingToolbar) floatingToolbar.setImageToolsEnabled(enabled);
            }
        }
    });

    // Log PIP availability
    if (Pip && Pip.isSupported()) {
        console.log("%c PIP Mode Available! Press Alt+G to float Gemini Nexus ",
                   "background: #4285f4; color: white; padding: 4px; border-radius: 3px");
    }

})();
