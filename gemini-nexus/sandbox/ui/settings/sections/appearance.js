
// sandbox/ui/settings/sections/appearance.js

export class AppearanceSection {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    getPipSystemThemeOverride() {
        try {
            // Prefer sandbox's own URL params (passed by sidepanel FrameManager)
            const selfParams = new URLSearchParams(window.location.search);
            const selfInPip = selfParams.get('inPip') === 'true';
            const selfSystemTheme = selfParams.get('systemTheme');
            if (selfInPip && (selfSystemTheme === 'dark' || selfSystemTheme === 'light')) {
                return selfSystemTheme;
            }

            // Fallback: read parent URL params (older builds)
            const parentSearch = window.parent && window.parent.location ? window.parent.location.search : '';
            if (!parentSearch) return null;

            const params = new URLSearchParams(parentSearch);
            const inPip = params.get('inPip') === 'true';
            const systemTheme = params.get('systemTheme');

            if (!inPip) return null;
            if (systemTheme === 'dark' || systemTheme === 'light') return systemTheme;
            return null;
        } catch {
            return null;
        }
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            themeSelect: get('theme-select'),
            languageSelect: get('language-select')
        };
    }

    bindEvents() {
        const { themeSelect, languageSelect } = this.elements;

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => this.fire('onThemeChange', e.target.value));
        }
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => this.fire('onLanguageChange', e.target.value));
        }

        // System Theme Listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
             if (themeSelect && themeSelect.value === 'system') {
                 this.applyVisualTheme('system');
             }
        });
    }

    setTheme(theme) {
        if (this.elements.themeSelect) this.elements.themeSelect.value = theme;
        this.applyVisualTheme(theme);
    }

    setLanguage(lang) {
        if (this.elements.languageSelect) this.elements.languageSelect.value = lang;
    }

    applyVisualTheme(theme) {
        let applied = theme;
        if (theme === 'system') {
            // Document PiP windows can report unreliable prefers-color-scheme.
            // When running inside the extension PIP window, prefer the parent-provided override.
            const pipOverride = this.getPipSystemThemeOverride();
            if (pipOverride) {
                applied = pipOverride;
            } else {
                applied = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
        }
        document.documentElement.setAttribute('data-theme', applied);
    }

    fire(event, data) {
        if (this.callbacks[event]) this.callbacks[event](data);
    }
}
