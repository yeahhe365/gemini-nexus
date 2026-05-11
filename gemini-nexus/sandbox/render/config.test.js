// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { configureMarkdown } from './config.js';
import { transformMarkdown } from './pipeline.js';

function createMarkedStub() {
    const state = {
        renderer: null
    };

    return {
        Renderer: class {},
        use(options) {
            state.renderer = options.renderer;
        },
        parse(text) {
            const match = String(text || '').match(/^```(\w+)?\n?([\s\S]*?)\n?```$/);
            if (match && state.renderer?.code) {
                return state.renderer.code({
                    lang: match[1] || '',
                    text: match[2] || ''
                });
            }
            return text || '';
        },
        state
    };
}

describe('configureMarkdown', () => {
    afterEach(() => {
        delete globalThis.marked;
        delete globalThis.hljs;
    });

    it('does not render a code-copy header for empty fenced code blocks', () => {
        globalThis.marked = createMarkedStub();
        configureMarkdown();

        const html = transformMarkdown('```json\n```');

        expect(html).toBe('');
        expect(html).not.toContain('copy-code-btn');
    });

    it('keeps the code-copy button for non-empty code blocks', () => {
        globalThis.marked = createMarkedStub();
        configureMarkdown();

        const html = transformMarkdown('```json\n{"ok":true}\n```');

        expect(html).toContain('copy-code-btn');
        expect(html).toContain('{&quot;ok&quot;:true}');
    });
});
