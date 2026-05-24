// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initRendererMode } from './renderer.js';
import { loadLibs } from './loader.js';

const mockIds = vi.hoisted(() => ({
    next: 1,
}));

vi.mock('./loader.js', () => ({
    loadLibs: vi.fn(),
}));

vi.mock('../../shared/utils/index.js', () => ({
    createPrefixedId: (prefix) => `${prefix}_${mockIds.next++}`,
    getHighResImageUrl: (url) => `${url}?highres=1`,
}));

vi.mock('../../shared/media/watermark_remover.js', () => ({
    WatermarkRemover: {
        process: vi.fn(),
    },
}));

describe('renderer mode', () => {
    beforeEach(() => {
        mockIds.next = 1;
        document.body.innerHTML = '<p>old ui</p>';
        vi.clearAllMocks();
    });

    async function flushRenderer() {
        await Promise.resolve();
        await Promise.resolve();
    }

    it('renders every generated image and returns a fetch task for each one', async () => {
        const postMessage = vi.fn();
        const event = new MessageEvent('message', {
            data: {
                action: 'RENDER',
                reqId: 7,
                text: 'done',
                images: [
                    { url: 'https://example.test/one.png', alt: 'one' },
                    {
                        url: 'https://example.test/two.png',
                        alt: 'two" onerror="alert(1)',
                    },
                ],
            },
        });
        Object.defineProperty(event, 'source', {
            value: { postMessage },
        });

        initRendererMode();
        window.dispatchEvent(event);
        await flushRenderer();

        expect(postMessage).toHaveBeenCalledTimes(1);
        const [payload] = postMessage.mock.calls[0];
        const html = document.createElement('div');
        html.innerHTML = payload.html;

        expect(payload.reqId).toBe(7);
        expect(html.querySelectorAll('.generated-image')).toHaveLength(2);
        expect(html.querySelector('.generated-image[onerror]')).toBeNull();
        expect(payload.fetchTasks).toEqual([
            {
                reqId: expect.stringMatching(/^gen_img_/),
                url: 'https://example.test/one.png?highres=1',
            },
            {
                reqId: expect.stringMatching(/^gen_img_/),
                url: 'https://example.test/two.png?highres=1',
            },
        ]);
    });

    it('ignores non-object renderer messages', () => {
        initRendererMode();

        expect(() => {
            window.dispatchEvent(new MessageEvent('message', { data: null }));
        }).not.toThrow();
    });

    it('waits for Markdown dependencies before rendering toolbar results', async () => {
        let resolveDependencies;
        loadLibs.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveDependencies = resolve;
            })
        );
        globalThis.marked = {
            parse: vi.fn(() => '<h3>Rendered</h3>'),
        };
        const postMessage = vi.fn();
        const event = new MessageEvent('message', {
            data: {
                action: 'RENDER',
                reqId: 8,
                text: '### Rendered',
            },
        });
        Object.defineProperty(event, 'source', {
            value: { postMessage },
        });

        initRendererMode();
        window.dispatchEvent(event);
        await flushRenderer();

        expect(postMessage).not.toHaveBeenCalled();

        resolveDependencies();
        await flushRenderer();

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage.mock.calls[0][0]).toMatchObject({
            action: 'RENDER_RESULT',
            html: '<h3>Rendered</h3>',
            reqId: 8,
        });

        delete globalThis.marked;
    });
});
