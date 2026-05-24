// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildArtifactSrcDoc,
    createLiveArtifactPreview,
    enhanceLiveArtifacts,
    getArtifactKind,
    sanitizeArtifactMarkup,
    setMermaidLoaderForTest,
} from './artifacts.js';
import { setLanguagePreference } from '../core/i18n.js';

function createCodeBlock(language, code) {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    wrapper.dataset.codeLang = language;

    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.textContent = code;
    pre.appendChild(codeElement);
    wrapper.appendChild(pre);

    return wrapper;
}

function readFrameSrcDoc(frame) {
    return frame.getAttribute('srcdoc') || frame.srcdoc || '';
}

async function flushMicrotasks() {
    for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
    }
}

describe('Live Artifact previews', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        setLanguagePreference('en');
        setMermaidLoaderForTest();
    });

    it('detects previewable artifact languages and common bare diagrams', () => {
        expect(getArtifactKind('html', '<div>Hello</div>')).toBe('html');
        expect(getArtifactKind('svg', '<svg viewBox="0 0 1 1"></svg>')).toBe('svg');
        expect(getArtifactKind('mermaid', 'graph TD\n  A --> B')).toBe('mermaid');
        expect(getArtifactKind('plaintext', 'sequenceDiagram\n  A->>B: Hi')).toBe('mermaid');
        expect(getArtifactKind('javascript', 'console.log("no preview")')).toBeNull();
    });

    it('renders HTML previews in a scriptless iframe with sanitized srcdoc', () => {
        const root = document.createElement('div');
        const wrapper = createCodeBlock(
            'html',
            [
                '<button onclick="alert(1)">Run</button>',
                '<script>alert(2)</script>',
                '<iframe srcdoc="<script>alert(3)</script>"></iframe>',
                '<img src="https://example.com/remote.png">',
                '<img src="data:image/png;base64,AAAA">',
            ].join('')
        );
        root.appendChild(wrapper);

        enhanceLiveArtifacts(root);

        const frame = wrapper.querySelector('iframe.live-artifact-frame');
        const srcdoc = readFrameSrcDoc(frame);

        expect(frame).not.toBeNull();
        expect(frame.getAttribute('sandbox')).toBe('');
        expect(frame.getAttribute('allow')).toBeNull();
        expect(srcdoc).toContain('<button>Run</button>');
        expect(srcdoc).toContain('data:image/png;base64,AAAA');
        expect(srcdoc).not.toContain('<script');
        expect(srcdoc).not.toContain('onclick');
        expect(srcdoc).not.toContain('srcdoc=');
        expect(srcdoc).not.toContain('https://example.com');
    });

    it('sanitizes SVG previews before embedding them in srcdoc', () => {
        const srcdoc = buildArtifactSrcDoc(
            'svg',
            [
                '<svg viewBox="0 0 10 10" onclick="alert(1)">',
                '<script>alert(2)</script>',
                '<foreignObject><button>bad</button></foreignObject>',
                '<a href="javascript:alert(3)"><rect width="10" height="10"/></a>',
                '</svg>',
            ].join('')
        );

        expect(srcdoc).toContain('<svg');
        expect(srcdoc).toContain('<rect');
        expect(srcdoc).not.toContain('<script');
        expect(srcdoc).not.toContain('onclick');
        expect(srcdoc).not.toContain('foreignObject');
        expect(srcdoc).not.toContain('javascript:');
    });

    it('enhances Mermaid code blocks with sanitized rendered SVG output', async () => {
        const root = document.createElement('div');
        const wrapper = createCodeBlock('mermaid', 'graph TD\n  A --> B');
        root.appendChild(wrapper);
        document.body.appendChild(root);
        const renderMermaid = vi.fn(
            async () =>
                '<svg onclick="alert(1)"><script>alert(2)</script><text>Rendered</text></svg>'
        );

        enhanceLiveArtifacts(root, { renderMermaid });
        await flushMicrotasks();

        const preview = wrapper.querySelector('.live-artifact-preview');
        const body = wrapper.querySelector('.live-artifact-body-mermaid');

        expect(renderMermaid).toHaveBeenCalledWith('graph TD\n  A --> B');
        expect(preview?.dataset.liveArtifactKind).toBe('mermaid');
        expect(body?.textContent).toContain('Rendered');
        expect(body?.innerHTML).not.toContain('<script');
        expect(body?.innerHTML).not.toContain('onclick');
    });

    it('does not duplicate previews when the same node is enhanced again', () => {
        const wrapper = createCodeBlock('svg', '<svg viewBox="0 0 1 1"></svg>');

        enhanceLiveArtifacts(wrapper);
        enhanceLiveArtifacts(wrapper);

        expect(wrapper.querySelectorAll('.live-artifact-preview')).toHaveLength(1);
    });

    it('can use an injected Mermaid loader for the default renderer', async () => {
        setMermaidLoaderForTest(async () => ({
            default: {
                initialize: vi.fn(),
                render: vi.fn(async () => ({ svg: '<svg><text>Loaded</text></svg>' })),
            },
        }));

        const preview = createLiveArtifactPreview('mermaid', 'graph TD\n  A --> B');
        document.body.appendChild(preview);
        await flushMicrotasks();

        expect(preview.textContent).toContain('Loaded');
    });

    it('keeps sanitizer usable without DOM APIs', () => {
        const originalDocument = globalThis.document;

        try {
            Reflect.deleteProperty(globalThis, 'document');

            expect(sanitizeArtifactMarkup('<b>x</b>', 'html')).toBe('&lt;b&gt;x&lt;/b&gt;');
        } finally {
            globalThis.document = originalDocument;
        }
    });
});
