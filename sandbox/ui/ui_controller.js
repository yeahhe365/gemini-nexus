import { ChatController } from './chat.js';
import { SidebarController } from './sidebar.js';
import { SettingsController } from './settings/index.js';
import { ViewerController } from './viewer.js';
import { TabSelectorController } from './tab_selector.js';
import { createModelOptions, getPreferredModel } from './model_options.js';
import { resizeSelectToSelectedOption } from './model_select_width.js';
import { syncModelPicker } from './model_picker.js';
import { syncWebThinkingToggle } from './web_thinking_toggle.js';

export class UIController {
    constructor(elements) {
        this.layoutResizeFrame = null;
        this.checkLayout();

        this.chat = new ChatController(elements);

        this.sidebar = new SidebarController(elements, {
            onOverlayClick: () => this.settings.close(),
        });

        this.settings = new SettingsController({
            onOpen: () => this.sidebar.close(),
            onSettingsChanged: (connectionSettings, meta = {}) => {
                this.updateModelList(connectionSettings);
                if (meta.providerChanged) {
                    document.dispatchEvent(new CustomEvent('gemini-provider-changed'));
                }
            },
        });

        this.viewer = new ViewerController();

        this.tabSelector = new TabSelectorController();

        this.inputFn = this.chat.inputFn;
        this.historyDiv = this.chat.historyDiv;
        this.sendBtn = this.chat.sendBtn;
        this.modelSelect = elements.modelSelect;
        this.webThinkingToggle = document.getElementById('web-thinking-toggle');
        this.tabSwitcherBtn = document.getElementById('tab-switcher-btn');
        window.addEventListener('resize', () => this.scheduleLayoutCheck());
        document.addEventListener('gemini-language-changed', () =>
            this.updateWebThinkingToggle(this.settings.connectionData)
        );
        this.updateWebThinkingToggle(this.settings.connectionData);
    }

    checkLayout() {
        // Threshold for Wide Mode (e.g. Full Page Tab or large side panel)
        const isWide = window.innerWidth > 800;
        const wasWide = document.body.classList.contains('layout-wide');
        if (isWide) {
            document.body.classList.add('layout-wide');
        } else {
            document.body.classList.remove('layout-wide');
        }

        if (this.sidebar && wasWide !== isWide) {
            this.sidebar.handleLayoutModeChange(isWide);
        }
    }

    setHostContext(context = {}) {
        document.body.classList.toggle('host-tab', context.isTab === true);
    }

    scheduleLayoutCheck() {
        if (this.layoutResizeFrame !== null) return;

        this.layoutResizeFrame = window.requestAnimationFrame(() => {
            this.layoutResizeFrame = null;
            this.checkLayout();
        });
    }

    updateModelList(settings) {
        if (!this.modelSelect) return;

        const preferred = getPreferredModel(settings, this.modelSelect.value);
        this.modelSelect.innerHTML = '';
        const options = createModelOptions(settings);

        options.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            this.modelSelect.appendChild(optionElement);
        });

        // Restore selection if valid, else default
        const match = options.find((option) => option.value === preferred);
        if (match) {
            this.modelSelect.value = preferred;
        } else {
            if (options.length > 0) {
                this.modelSelect.value = options[0].value;
            }
            this.modelSelect.dispatchEvent(new Event('change'));
        }

        this.resizeModelSelect();
        this.updateWebThinkingToggle(settings);
    }

    resizeModelSelect() {
        resizeSelectToSelectedOption(this.modelSelect);
        syncModelPicker(this.modelSelect);
    }

    updateWebThinkingToggle(settings = this.settings?.connectionData || {}) {
        syncWebThinkingToggle(this.webThinkingToggle, settings, this.modelSelect?.value);
    }

    updateStatus(text) {
        this.chat.updateStatus(text);
    }
    clearChatHistory() {
        this.chat.clear();
    }
    getChatScrollState() {
        return this.chat.getScrollState();
    }
    restoreChatScrollState(state) {
        this.chat.restoreScrollState(state);
    }
    followStreamingContent() {
        this.chat.followStreamingContent();
    }
    scrollToBottom(options) {
        this.chat.scrollToBottom(options);
    }
    resetInput() {
        this.chat.resetInput();
    }
    setLoading(isLoading) {
        this.chat.setLoading(isLoading);
    }

    renderHistoryList(sessions, groups, currentId, callbacks, renderState) {
        this.sidebar.renderList(sessions, groups, currentId, callbacks, renderState);
    }

    updateShortcuts(payload) {
        this.settings.updateShortcuts(payload);
    }
    updateTheme(theme) {
        this.settings.updateTheme(theme);
    }
    updateLanguage(lang) {
        this.settings.updateLanguage(lang);
    }

    // Tab Selector
    openTabSelector(tabs, onSelect, lockedTabId) {
        this.tabSelector.open(tabs, onSelect, lockedTabId);
    }

    toggleTabSwitcher(show) {
        if (this.tabSelector) {
            this.tabSelector.setControlVisible(show);
        }
        if (this.tabSwitcherBtn) {
            this.tabSwitcherBtn.hidden = true;
        }
    }

    updateBrowserControlState(state) {
        if (this.tabSelector) this.tabSelector.updateControlState(state);
    }

    setBrowserControlCallbacks(callbacks) {
        if (this.tabSelector) this.tabSelector.setControlCallbacks(callbacks);
    }
}
