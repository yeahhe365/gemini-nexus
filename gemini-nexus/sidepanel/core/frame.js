
// sidepanel/core/frame.js

export class FrameManager {
    constructor() {
        this.iframe = document.getElementById('sandbox-frame');
        this.skeleton = document.getElementById('skeleton');
    }

    init() {
        // --- Optimization: Instant Load (Sync) ---
        // Use localStorage for Theme/Lang to avoid waiting for async chrome.storage
        const cachedTheme = localStorage.getItem('geminiTheme') || 'system';
        const cachedLang = localStorage.getItem('geminiLanguage') || 'system';

        const params = new URLSearchParams({
            theme: cachedTheme,
            lang: cachedLang
        });

        // Set an absolute extension URL to avoid relative-frame navigation errors.
        this.iframe.src = chrome.runtime.getURL(`sandbox/index.html?${params.toString()}`);
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
