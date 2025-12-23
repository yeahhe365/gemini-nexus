
// sandbox/ui/ui_controller.js
import { ChatController } from './chat.js';
import { SidebarController } from './sidebar.js';
import { SettingsController } from './settings.js';
import { ViewerController } from './viewer.js';
import { TabSelectorController } from './tab_selector.js';

export class UIController {
    constructor(elements) {
        // Initialize Sub-Controllers
        this.chat = new ChatController(elements);
        
        this.sidebar = new SidebarController(elements, {
            onOverlayClick: () => this.settings.close()
        });
        
        // Settings and Viewer now self-manage their DOM
        this.settings = new SettingsController({
            onOpen: () => this.sidebar.close(),
            onSettingsChanged: (connectionSettings) => {
                this.updateModelList(connectionSettings.useOfficialApi);
            }
        });
        
        this.viewer = new ViewerController();
        
        this.tabSelector = new TabSelectorController();

        // Properties exposed for external use (AppController/MessageHandler)
        this.inputFn = this.chat.inputFn;
        this.historyDiv = this.chat.historyDiv;
        this.sendBtn = this.chat.sendBtn;
        this.modelSelect = elements.modelSelect;
        this.tabSwitcherBtn = document.getElementById('tab-switcher-btn');

        // Initialize Layout Detection
        this.checkLayout();
        window.addEventListener('resize', () => this.checkLayout());
    }

    checkLayout() {
        // Threshold for Wide Mode (e.g. Full Page Tab or large side panel)
        const isWide = window.innerWidth > 800;
        if (isWide) {
            document.body.classList.add('layout-wide');
        } else {
            document.body.classList.remove('layout-wide');
        }
    }

    // --- Dynamic Model List ---

    updateModelList(useOfficialApi) {
        if (!this.modelSelect) return;
        
        const current = this.modelSelect.value;
        this.modelSelect.innerHTML = '';
        
        let opts = [];
        if (useOfficialApi) {
            // Official API Models
            opts = [
                { val: 'gemini-3-flash-preview', txt: 'Gemini 3 Flash' },
                { val: 'gemini-3-pro-preview', txt: 'Gemini 3 Pro' }
            ];
        } else {
            // Web Client Models
            opts = [
                { val: 'gemini-3-flash', txt: 'Fast' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro' }
            ];
        }
        
        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.txt;
            this.modelSelect.appendChild(opt);
        });
        
        // Restore selection if valid, else default
        const match = opts.find(o => o.val === current);
        if (match) {
            this.modelSelect.value = current;
        } else {
            // Default to first option
            if (opts.length > 0) {
                this.modelSelect.value = opts[0].val;
            }
            // Dispatch change to update app state
            this.modelSelect.dispatchEvent(new Event('change'));
        }
        
        this._resizeModelSelect();
    }

    _resizeModelSelect() {
        const select = this.modelSelect;
        if (!select) return;
        
        // Safety check for empty or invalid selection
        if (select.selectedIndex === -1) {
            if (select.options.length > 0) select.selectedIndex = 0;
            else return; // Should not happen if options exist
        }

        const tempSpan = document.createElement('span');
        Object.assign(tempSpan.style, {
            visibility: 'hidden',
            position: 'absolute',
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: window.getComputedStyle(select).fontFamily,
            whiteSpace: 'nowrap'
        });
        tempSpan.textContent = select.options[select.selectedIndex].text;
        document.body.appendChild(tempSpan);
        const width = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        select.style.width = `${width + 34}px`;
    }

    // --- Delegation Methods ---

    // Chat / Input
    updateStatus(text) { this.chat.updateStatus(text); }
    clearChatHistory() { this.chat.clear(); }
    scrollToBottom() { this.chat.scrollToBottom(); }
    resetInput() { this.chat.resetInput(); }
    setLoading(isLoading) { this.chat.setLoading(isLoading); }
    
    // Sidebar
    toggleSidebar() { this.sidebar.toggle(); }
    closeSidebar() { this.sidebar.close(); }
    renderHistoryList(sessions, currentId, callbacks) {
        this.sidebar.renderList(sessions, currentId, callbacks);
    }

    // Settings
    updateShortcuts(payload) { this.settings.updateShortcuts(payload); }
    updateTheme(theme) { this.settings.updateTheme(theme); }
    updateLanguage(lang) { this.settings.updateLanguage(lang); }
    
    // Tab Selector
    openTabSelector(tabs, onSelect, lockedTabId) {
        this.tabSelector.open(tabs, onSelect, lockedTabId);
    }
    
    toggleTabSwitcher(show) {
        if (this.tabSwitcherBtn) {
            this.tabSwitcherBtn.style.display = show ? 'flex' : 'none';
        }
    }
}
