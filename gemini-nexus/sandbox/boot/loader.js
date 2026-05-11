// sandbox/boot/loader.js
import { configureMarkdown } from '../render/config.js';

export const MARKDOWN_READY_EVENT = 'gemini-markdown-ready';

let markedLoadPromise = null;
let markdownReady = false;

export function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = (event) => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

export function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function emitMarkdownReady() {
    if (typeof marked === 'undefined') return;

    configureMarkdown();

    if (!markdownReady) {
        markdownReady = true;
        window.dispatchEvent(new CustomEvent(MARKDOWN_READY_EVENT));
    }
}

function loadMarked() {
    if (typeof marked !== 'undefined') {
        emitMarkdownReady();
        return Promise.resolve();
    }

    if (!markedLoadPromise) {
        markedLoadPromise = loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
            .then(() => {
                emitMarkdownReady();
            })
            .catch((error) => {
                markedLoadPromise = null;
                throw error;
            });
    }

    return markedLoadPromise;
}

export async function loadLibs() {
    try {
        // Load Marked (Priority for chat rendering)
        // Race against a timeout so app startup is never blocked by a slow CDN.
        // The original script promise keeps running and emits MARKDOWN_READY_EVENT when it eventually loads.
        let timedOut = false;
        let timeoutId = null;
        const markedPromise = loadMarked()
            .then(() => true)
            .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                console.warn("Marked load issue:", message);
                return false;
            });

        await Promise.race([
            markedPromise,
            new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    resolve(false);
                }, 5000);
            })
        ]);

        if (timeoutId) clearTimeout(timeoutId);
        
        if (timedOut && typeof marked === 'undefined') {
            console.warn("Marked load issue:", "CDN Timeout");
        }

        // Load others in parallel
        loadCSS('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css');
        loadCSS('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css');

        Promise.all([
            loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js'),
            loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'),
            loadScript('https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.basic.min.js')
        ]).then(() => {
             // Auto-render ext for Katex
             return loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js');
        }).catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn("Optional libs load failed", message);
        });

        console.log("Lazy dependencies loading...");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("Deferred loading failed", message);
    }
}
