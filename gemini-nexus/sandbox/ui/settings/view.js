
// sandbox/ui/settings/view.js
import { ConnectionSection } from './sections/connection.js';
import { GeneralSection } from './sections/general.js';
import { AppearanceSection } from './sections/appearance.js';
import { ShortcutsSection } from './sections/shortcuts.js';
import { AboutSection } from './sections/about.js';

export class SettingsView {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        
        // Initialize Sections
        this.connection = new ConnectionSection();
        
        this.general = new GeneralSection({
            onTextSelectionChange: (val) => this.fire('onTextSelectionChange', val),
            onImageToolsChange: (val) => this.fire('onImageToolsChange', val),
            onSidebarBehaviorChange: (val) => this.fire('onSidebarBehaviorChange', val),
            onSidePanelScopeChange: (val) => this.fire('onSidePanelScopeChange', val)
        });
        
        this.appearance = new AppearanceSection({
            onThemeChange: (val) => this.fire('onThemeChange', val),
            onLanguageChange: (val) => this.fire('onLanguageChange', val)
        });
        
        this.shortcuts = new ShortcutsSection();
        
        this.about = new AboutSection({
            onDownloadLogs: () => this.fire('onDownloadLogs')
        });

        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        
        this.elements = {
            modal: get('settings-modal'),
            btnClose: get('close-settings'),
            btnSave: get('save-shortcuts'),
            btnReset: get('reset-shortcuts')
        };
    }

    bindEvents() {
        const { modal, btnClose, btnSave, btnReset } = this.elements;

        // Modal actions
        if (btnClose) btnClose.addEventListener('click', () => this.close());
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.close();
            });
        }

        // Action Buttons
        if (btnSave) btnSave.addEventListener('click', () => this.handleSave());
        if (btnReset) btnReset.addEventListener('click', () => this.handleReset());

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('visible')) {
                this.close();
            }
        });
    }

    handleSave() {
        const shortcutsData = this.shortcuts.getData();
        const connectionData = this.connection.getData();
        const generalData = this.general.getData();
        
        const data = {
            shortcuts: shortcutsData,
            connection: connectionData,
            textSelection: generalData.textSelection,
            imageTools: generalData.imageTools,
            accountIndices: generalData.accountIndices,
            sidebarBehavior: generalData.sidebarBehavior,
            sidePanelScope: generalData.sidePanelScope,
            contextMode: generalData.contextMode,
            contextRecentTurns: generalData.contextRecentTurns
        };
        
        this.fire('onSave', data);
        this.close();
    }

    handleReset() {
        this.fire('onReset');
    }

    // --- Public API ---

    open() {
        if (this.elements.modal) {
            this.elements.modal.classList.add('visible');
            this.fire('onOpen');
        }
    }

    close() {
        if (this.elements.modal) {
            this.elements.modal.classList.remove('visible');
        }
    }

    // Delegation to Shortcuts
    setShortcuts(shortcuts) {
        this.shortcuts.setData(shortcuts);
    }

    // Delegation to Appearance
    setThemeValue(theme) {
        this.appearance.setTheme(theme);
    }

    setLanguageValue(lang) {
        this.appearance.setLanguage(lang);
    }
    
    applyVisualTheme(theme) {
        this.appearance.applyVisualTheme(theme);
    }

    // Delegation to General
    setToggles(textSelection, imageTools) {
        this.general.setToggles(textSelection, imageTools);
    }
    
    setSidebarBehavior(behavior) {
        this.general.setSidebarBehavior(behavior);
    }

    setAccountIndices(val) {
        this.general.setAccountIndices(val);
    }

    setSidePanelScope(scope) {
        this.general.setSidePanelScope(scope);
    }

    setContextSettings(settings) {
        this.general.setContextSettings(settings);
    }

    // Delegation to Connection
    setConnectionSettings(data) {
        this.connection.setData(data);
    }

    // Delegation to About
    displayStars(count) {
        this.about.displayStars(count);
    }

    hasFetchedStars() {
        return this.about.hasFetchedStars();
    }

    getCurrentVersion() {
        return this.about.getCurrentVersion();
    }

    displayUpdateStatus(latest, current, isUpdateAvailable) {
        this.about.displayUpdateStatus(latest, current, isUpdateAvailable);
    }

    setAppVersion(version) {
        this.about.setCurrentVersion(version);
    }

    fire(event, data) {
        if (this.callbacks[event]) this.callbacks[event](data);
    }
}
