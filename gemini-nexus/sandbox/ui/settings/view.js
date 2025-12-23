
// sandbox/ui/settings/view.js

export class SettingsView {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        
        this.elements = {
            modal: get('settings-modal'),
            btnClose: get('close-settings'),
            
            themeSelect: get('theme-select'),
            languageSelect: get('language-select'),
            
            useOfficialApiToggle: get('use-official-api-toggle'),
            apiKeyInput: get('api-key-input'),
            apiKeyContainer: get('api-key-container'),
            thinkingLevelSelect: get('thinking-level-select'),
            
            textSelectionToggle: get('text-selection-toggle'),
            imageToolsToggle: get('image-tools-toggle'),
            accountIndicesInput: get('account-indices-input'),
            
            inputQuickAsk: get('shortcut-quick-ask'),
            inputOpenPanel: get('shortcut-open-panel'),
            
            btnSave: get('save-shortcuts'),
            btnReset: get('reset-shortcuts'),
            
            btnDownloadLogs: get('download-logs'),
            
            starEl: get('star-count'),
            
            sidebarRadios: document.querySelectorAll('input[name="sidebar-behavior"]')
        };
    }

    bindEvents() {
        const { modal, btnClose, btnSave, btnReset, themeSelect, languageSelect, 
                inputQuickAsk, inputOpenPanel, textSelectionToggle, imageToolsToggle, 
                accountIndicesInput, sidebarRadios, btnDownloadLogs, useOfficialApiToggle, apiKeyContainer } = this.elements;

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
        
        if (btnDownloadLogs) {
            btnDownloadLogs.addEventListener('click', () => this.fire('onDownloadLogs'));
        }

        // Instant Updates
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => this.fire('onThemeChange', e.target.value));
        }
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => this.fire('onLanguageChange', e.target.value));
        }
        
        // Toggles
        if (useOfficialApiToggle) {
            useOfficialApiToggle.addEventListener('change', (e) => {
                if (apiKeyContainer) apiKeyContainer.style.display = e.target.checked ? 'flex' : 'none';
            });
        }

        if (textSelectionToggle) {
            textSelectionToggle.addEventListener('change', (e) => this.fire('onTextSelectionChange', e.target.value));
        }
        if (imageToolsToggle) {
            imageToolsToggle.addEventListener('change', (e) => this.fire('onImageToolsChange', e.target.value));
        }
        if (sidebarRadios) {
            sidebarRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if(e.target.checked) this.fire('onSidebarBehaviorChange', e.target.value);
                });
            });
        }

        // Shortcuts
        this.setupShortcutInput(inputQuickAsk);
        this.setupShortcutInput(inputOpenPanel);

        // System Theme Listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
             if (themeSelect && themeSelect.value === 'system') {
                 this.applyVisualTheme('system');
             }
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('visible')) {
                this.close();
            }
        });
    }

    handleSave() {
        const { inputQuickAsk, inputOpenPanel, textSelectionToggle, imageToolsToggle, accountIndicesInput, useOfficialApiToggle, apiKeyInput, thinkingLevelSelect } = this.elements;
        
        const data = {
            shortcuts: {
                quickAsk: inputQuickAsk ? inputQuickAsk.value : null,
                openPanel: inputOpenPanel ? inputOpenPanel.value : null,
            },
            connection: {
                useOfficialApi: useOfficialApiToggle ? useOfficialApiToggle.checked : false,
                apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
                thinkingLevel: thinkingLevelSelect ? thinkingLevelSelect.value : "high"
            },
            textSelection: textSelectionToggle ? textSelectionToggle.checked : true,
            imageTools: imageToolsToggle ? imageToolsToggle.checked : true,
            accountIndices: accountIndicesInput ? accountIndicesInput.value : "0"
        };
        
        this.fire('onSave', data);
        this.close();
    }

    handleReset() {
        this.fire('onReset');
    }

    setupShortcutInput(inputEl) {
        if (!inputEl) return;
        inputEl.addEventListener('keydown', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
            
            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            if (e.metaKey) keys.push('Meta');
            
            let k = e.key.toUpperCase();
            if (k === ' ') k = 'Space';
            keys.push(k);

            inputEl.value = keys.join('+');
        });
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

    setShortcuts(shortcuts) {
        if (this.elements.inputQuickAsk) this.elements.inputQuickAsk.value = shortcuts.quickAsk;
        if (this.elements.inputOpenPanel) this.elements.inputOpenPanel.value = shortcuts.openPanel;
    }

    setThemeValue(theme) {
        if (this.elements.themeSelect) this.elements.themeSelect.value = theme;
        this.applyVisualTheme(theme);
    }

    setLanguageValue(lang) {
        if (this.elements.languageSelect) this.elements.languageSelect.value = lang;
    }

    setToggles(textSelection, imageTools) {
        if (this.elements.textSelectionToggle) this.elements.textSelectionToggle.checked = textSelection;
        if (this.elements.imageToolsToggle) this.elements.imageToolsToggle.checked = imageTools;
    }
    
    setConnectionSettings(useOfficialApi, apiKey, thinkingLevel) {
        if (this.elements.useOfficialApiToggle) {
            this.elements.useOfficialApiToggle.checked = useOfficialApi;
            if (this.elements.apiKeyContainer) {
                this.elements.apiKeyContainer.style.display = useOfficialApi ? 'flex' : 'none';
            }
        }
        if (this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = apiKey || "";
        }
        if (this.elements.thinkingLevelSelect) {
            this.elements.thinkingLevelSelect.value = thinkingLevel || "high";
        }
    }

    setSidebarBehavior(behavior) {
        if (this.elements.sidebarRadios) {
            const val = behavior || 'auto';
            this.elements.sidebarRadios.forEach(radio => {
                radio.checked = (radio.value === val);
            });
        }
    }

    setAccountIndices(val) {
        if (this.elements.accountIndicesInput) this.elements.accountIndicesInput.value = val || "0";
    }

    applyVisualTheme(theme) {
        let applied = theme;
        if (theme === 'system') {
             applied = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', applied);
    }

    displayStars(count) {
        const { starEl } = this.elements;
        if (!starEl) return;
        
        if (count) {
            const formatted = count > 999 ? (count/1000).toFixed(1) + 'k' : count;
            starEl.textContent = `★ ${formatted}`;
            starEl.style.display = 'inline-flex';
            starEl.dataset.fetched = "true";
        } else {
            starEl.style.display = 'none';
        }
    }

    hasFetchedStars() {
        return this.elements.starEl && this.elements.starEl.dataset.fetched === "true";
    }

    fire(event, data) {
        if (this.callbacks[event]) this.callbacks[event](data);
    }
}