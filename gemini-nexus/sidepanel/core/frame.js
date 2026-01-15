
// sidepanel/core/frame.js

export class FrameManager {
    constructor() {
        this.iframe = document.getElementById('sandbox-frame');
        this.skeleton = document.getElementById('skeleton');
    }

    async init() {
        // Check if we're in PIP window by reading URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const inPip = urlParams.get('inPip') === 'true';
        const pipSystemTheme = urlParams.get('systemTheme'); // 'dark' or 'light'

        console.log('[Frame] URL params - inPip:', inPip, 'systemTheme:', pipSystemTheme);

        // --- Read from chrome.storage (source of truth) ---
        // IMPORTANT: Don't use localStorage in PIP window iframe - it has separate context!
        // User settings are stored in chrome.storage.local, so we MUST read from there.
        const storage = await chrome.storage.local.get(['geminiTheme', 'geminiLanguage']);
        let cachedTheme = storage.geminiTheme || 'system';
        const cachedLang = storage.geminiLanguage || 'system';

        console.log('[Frame] Theme from chrome.storage:', cachedTheme);

        // IMPORTANT: Resolve 'system' theme to actual 'light' or 'dark'
        if (cachedTheme === 'system') {
            if (inPip && pipSystemTheme) {
                // Use theme passed from PIP window via URL parameter (most reliable!)
                cachedTheme = pipSystemTheme;
                console.log('[Frame] Using system theme from URL parameter:', cachedTheme);
            } else {
                // Fallback: detect in current context
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                cachedTheme = systemDark ? 'dark' : 'light';
                console.log('[Frame] Detected system theme in current context:', cachedTheme);
            }
        }

        // Sync to localStorage for fast access (optional, just for caching)
        localStorage.setItem('geminiTheme', cachedTheme);
        localStorage.setItem('geminiLanguage', cachedLang);

        // Pass PIP context down into the sandbox iframe so it can resolve 'system'
        // theme reliably (Document PiP prefers-color-scheme can be inconsistent).
        const pipCtxParams = new URLSearchParams();
        if (inPip) {
            pipCtxParams.set('inPip', 'true');
            if (pipSystemTheme) pipCtxParams.set('systemTheme', pipSystemTheme);
        }
        const pipCtxSuffix = pipCtxParams.toString();

        // Set src immediately to start loading HTML
        this.iframe.src = `../sandbox/index.html?theme=${encodeURIComponent(cachedTheme)}&lang=${encodeURIComponent(cachedLang)}${pipCtxSuffix ? `&${pipCtxSuffix}` : ''}`;
    }

    reveal() {
        this.iframe.classList.add('loaded');
        if (this.skeleton) this.skeleton.classList.add('hidden');
    }

    postMessage(message) {
        if (this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage(message, '*');
        }
    }

    getWindow() {
        return this.iframe.contentWindow;
    }

    isWindow(sourceWindow) {
        return this.iframe.contentWindow && sourceWindow === this.iframe.contentWindow;
    }
}
