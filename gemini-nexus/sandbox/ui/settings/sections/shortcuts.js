
// sandbox/ui/settings/sections/shortcuts.js

export class ShortcutsSection {
    constructor() {
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            inputQuickAsk: get('shortcut-quick-ask'),
            inputOpenPanel: get('shortcut-open-panel'),
            inputBrowserControl: get('shortcut-browser-control'),
            inputFocusInput: get('shortcut-focus-input'),
            inputSwitchModel: get('shortcut-switch-model')
        };
    }

    bindEvents() {
        this.setupShortcutInput(this.elements.inputQuickAsk);
        this.setupShortcutInput(this.elements.inputOpenPanel);
        this.setupShortcutInput(this.elements.inputBrowserControl);
        this.setupShortcutInput(this.elements.inputFocusInput);
        this.setupShortcutInput(this.elements.inputSwitchModel);
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

    setData(shortcuts) {
        if (this.elements.inputQuickAsk) this.elements.inputQuickAsk.value = shortcuts.quickAsk || "Ctrl+G";
        if (this.elements.inputOpenPanel) this.elements.inputOpenPanel.value = shortcuts.openPanel || "Alt+S";
        if (this.elements.inputBrowserControl) this.elements.inputBrowserControl.value = shortcuts.browserControl || "Ctrl+B";
        if (this.elements.inputFocusInput) this.elements.inputFocusInput.value = shortcuts.focusInput || "Ctrl+P";
        if (this.elements.inputSwitchModel) this.elements.inputSwitchModel.value = shortcuts.switchModel || "Tab";
    }

    getData() {
        const { inputQuickAsk, inputOpenPanel, inputBrowserControl, inputFocusInput, inputSwitchModel } = this.elements;
        return {
            quickAsk: inputQuickAsk ? inputQuickAsk.value : "Ctrl+G",
            openPanel: inputOpenPanel ? inputOpenPanel.value : "Alt+S",
            browserControl: inputBrowserControl ? inputBrowserControl.value : "Ctrl+B",
            focusInput: inputFocusInput ? inputFocusInput.value : "Ctrl+P",
            switchModel: inputSwitchModel ? inputSwitchModel.value : "Tab"
        };
    }
}