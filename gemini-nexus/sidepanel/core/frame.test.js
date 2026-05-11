// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameManager } from './frame.js';

describe('FrameManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="skeleton"></div>
            <iframe id="sandbox-frame"></iframe>
        `;
        localStorage.clear();
        globalThis.chrome = {
            runtime: {
                getURL: vi.fn((path) => `chrome-extension://test-id/${path}`)
            }
        };
    });

    it('loads the sandbox iframe with an absolute extension URL', () => {
        localStorage.setItem('geminiTheme', 'dark');
        localStorage.setItem('geminiLanguage', 'zh-CN');

        const manager = new FrameManager();
        manager.init();

        expect(chrome.runtime.getURL).toHaveBeenCalledWith('sandbox/index.html?theme=dark&lang=zh-CN');
        expect(document.getElementById('sandbox-frame').src).toBe(
            'chrome-extension://test-id/sandbox/index.html?theme=dark&lang=zh-CN'
        );
    });
});
