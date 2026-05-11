
// content/shortcuts.js

(function() {
    const DEFAULT_SHORTCUTS = {
        quickAsk: "Ctrl+G",
        openPanel: "Alt+S",
        browserControl: "Ctrl+B"
    };

    class ShortcutManager {
        constructor() {
            this.appShortcuts = { ...DEFAULT_SHORTCUTS };
            this.toolbarController = null;
            this.init();
        }

        setController(controller) {
            this.toolbarController = controller;
        }

        init() {
            // Initial Load
            chrome.storage.local.get(['geminiShortcuts'], (result) => {
                if (result.geminiShortcuts) {
                    this.appShortcuts = { ...this.appShortcuts, ...result.geminiShortcuts };
                }
            });

            // Listen for updates
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.geminiShortcuts) {
                    this.appShortcuts = { ...this.appShortcuts, ...changes.geminiShortcuts.newValue };
                }
            });

            // Bind global keys
            document.addEventListener('keydown', (e) => this.handleKeydown(e), true);
        }

        handleKeydown(e) {
            if (this.match(e, this.appShortcuts.openPanel)) {
                e.preventDefault(); 
                e.stopPropagation();
                chrome.runtime.sendMessage({ action: "OPEN_SIDE_PANEL" });
                return;
            }

            if (this.match(e, this.appShortcuts.quickAsk)) {
                e.preventDefault();
                e.stopPropagation();
                if (this.toolbarController) {
                    this.toolbarController.showGlobalInput();
                }
                return;
            }

            if (this.match(e, this.appShortcuts.browserControl)) {
                e.preventDefault();
                e.stopPropagation();
                // Toggle side panel / browser control
                chrome.runtime.sendMessage({ action: "TOGGLE_SIDE_PANEL_CONTROL" });
                return;
            }
        }

        match(event, shortcutString) {
            if (!shortcutString || typeof shortcutString !== 'string') return false;
            if (!event || typeof event.key !== 'string') return false;
            
            const parts = shortcutString.split('+').map(p => p.trim().toLowerCase());
            const key = event.key.toLowerCase();
            
            const hasCtrl = parts.includes('ctrl');
            const hasAlt = parts.includes('alt');
            const hasShift = parts.includes('shift');
            const hasMeta = parts.includes('meta') || parts.includes('command');
            
            if (event.ctrlKey !== hasCtrl) return false;
            if (event.altKey !== hasAlt) return false;
            if (event.shiftKey !== hasShift) return false;
            if (event.metaKey !== hasMeta) return false;

            const mainKeys = parts.filter(p => !['ctrl','alt','shift','meta','command'].includes(p));
            if (mainKeys.length !== 1) return false;

            return key === mainKeys[0];
        }
    }

    // Export singleton
    window.GeminiShortcuts = new ShortcutManager();
})();
