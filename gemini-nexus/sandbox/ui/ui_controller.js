
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
            onSettingsChanged: (connectionSettings, meta = {}) => {
                this.updateModelList(connectionSettings);
                if (meta.providerChanged) {
                    document.dispatchEvent(new CustomEvent('gemini-provider-changed'));
                }
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
        this.layoutResizeFrame = null;

        // Initialize Layout Detection
        this.checkLayout();
        window.addEventListener('resize', () => this.scheduleLayoutCheck());
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

    scheduleLayoutCheck() {
        if (this.layoutResizeFrame !== null) return;

        this.layoutResizeFrame = window.requestAnimationFrame(() => {
            this.layoutResizeFrame = null;
            this.checkLayout();
        });
    }

    // --- DynamicModel List ---

    updateModelList(settings) {
        if (!this.modelSelect) return;
        
        // Determine provider. Fallback to 'web' if not set.
        // Legacy support: if provider missing but useOfficialApi is true, assume 'official'.
        const provider = settings.provider || (settings.useOfficialApi ? 'official' : 'web');
        const preferred = provider === 'openai'
            ? (settings.openaiSelectedModel || settings.selectedModel || this.modelSelect.value)
            : (settings.selectedModel || this.modelSelect.value);
        this.modelSelect.innerHTML = '';
        
        let opts = [];
        if (provider === 'official') {
            const rawModels = settings.officialModel || "";
            const models = rawModels.split(',').map(m => m.trim()).filter(m => m);
            if (models.length === 0) {
                opts = [{ val: 'gemini-3-flash-preview', txt: 'gemini-3-flash-preview' }];
            } else {
                opts = models.map(m => ({ val: m, txt: m }));
            }
        } else if (provider === 'openai') {
            // OpenAI Compatible: Support multiple models comma-separated
            const rawModels = settings.openaiModel || "";
            // Split by comma, trim whitespace, remove empty entries
            const models = rawModels.split(',').map(m => m.trim()).filter(m => m);
            
            if (models.length === 0) {
                opts = [{ val: 'openai_custom', txt: 'Custom Model' }];
            } else {
                opts = models.map(m => ({ val: m, txt: m }));
            }
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
        const match = opts.find(o => o.val === preferred);
        if (match) {
            this.modelSelect.value = preferred;
        } else {
            // Default to first option
            if (opts.length > 0) {
                this.modelSelect.value = opts[0].val;
            }
            // Dispatch change to update app state
            this.modelSelect.dispatchEvent(new Event('change'));
        }
        
        this.resizeModelSelect();
    }

    resizeModelSelect() {
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
    getChatScrollState() { return this.chat.getScrollState(); }
    restoreChatScrollState(state) { this.chat.restoreScrollState(state); }
    followStreamingContent() { this.chat.followStreamingContent(); }
    scrollToBottom(options) { this.chat.scrollToBottom(options); }
    resetInput() { this.chat.resetInput(); }
    setLoading(isLoading) { this.chat.setLoading(isLoading); }
    
    // Sidebar
    toggleSidebar() { this.sidebar.toggle(); }
    closeSidebar() { this.sidebar.close(); }
    renderHistoryList(sessions, currentId, callbacks, renderState) {
        this.sidebar.renderList(sessions, currentId, callbacks, renderState);
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
