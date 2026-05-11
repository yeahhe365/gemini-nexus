
// content.js v4.2.3 -> content/index.js

console.log("%c Gemini Nexus v4.2.3 Ready ", "background: #333; color: #00ff00; font-size: 16px");

(function() {
    // Dependencies (Loaded via manifest order)
    const shortcuts = window.GeminiShortcuts;
    const router = window.GeminiMessageRouter;
    const Overlay = window.GeminiNexusOverlay;
    const Controller = window.GeminiToolbarController;

    // Initialize Helpers
    const selectionOverlay = new Overlay();
    const floatingToolbar = new Controller(); 

    // Initialize Router
    router.init(floatingToolbar, selectionOverlay);

    // Link Shortcuts
    shortcuts.setController(floatingToolbar);

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

})();