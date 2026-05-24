import { createPrefixedId } from '../../shared/utils/index.js';
import { t } from '../core/i18n.js';

const HTML_LANGUAGES = new Set(['html', 'htm', 'xhtml']);
const SVG_LANGUAGES = new Set(['svg']);
const MERMAID_LANGUAGES = new Set(['mermaid', 'mmd']);
const TEXT_LANGUAGES = new Set(['', 'plaintext', 'text', 'txt']);
const DANGEROUS_TAGS = new Set([
    'applet',
    'base',
    'embed',
    'iframe',
    'link',
    'meta',
    'object',
    'script',
]);
const BLOCKED_ATTRS = new Set(['srcdoc']);
const URI_ATTRS = new Set([
    'action',
    'background',
    'cite',
    'formaction',
    'href',
    'poster',
    'src',
    'xlink:href',
]);

let mermaidLoader = () => import('mermaid');
let mermaidModulePromise = null;

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeLanguage(language) {
    return String(language || '')
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();
}

function getCodeLanguage(wrapper) {
    const dataLang = wrapper.dataset?.codeLang;
    if (dataLang) return dataLang;

    const labelLang = wrapper.querySelector('.code-lang')?.textContent;
    if (labelLang) return labelLang;

    const code = wrapper.querySelector('pre code');
    const languageClass = Array.from(code?.classList || []).find((className) =>
        className.startsWith('language-')
    );
    return languageClass ? languageClass.slice('language-'.length) : '';
}

function looksLikeSvg(code) {
    return /^\s*<svg(?:\s|>)/i.test(code);
}

function looksLikeHtml(code) {
    return /^\s*(?:<!doctype\s+html|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>)|<(?:article|button|canvas|div|form|main|section|style|table)(?:\s|>))/i.test(
        code
    );
}

function stripMermaidComments(code) {
    return String(code || '')
        .replace(/^(?:\s*%%[^\n]*(?:\n|$))+/, '')
        .trim();
}

function looksLikeMermaid(code) {
    return /^(?:c4component|c4container|c4context|classdiagram|erdiagram|flowchart|gantt|gitgraph|graph|journey|mindmap|pie|quadrantchart|requirementdiagram|sequencediagram|statediagram(?:-v2)?|timeline)\b/i.test(
        stripMermaidComments(code)
    );
}

export function getArtifactKind(language, code = '') {
    const normalizedLanguage = normalizeLanguage(language);
    const trimmedCode = String(code || '').trim();

    if (HTML_LANGUAGES.has(normalizedLanguage)) return 'html';
    if (SVG_LANGUAGES.has(normalizedLanguage)) return 'svg';
    if (MERMAID_LANGUAGES.has(normalizedLanguage)) return 'mermaid';
    if (looksLikeSvg(trimmedCode)) return 'svg';

    if (TEXT_LANGUAGES.has(normalizedLanguage)) {
        if (looksLikeHtml(trimmedCode)) return 'html';
        if (looksLikeMermaid(trimmedCode)) return 'mermaid';
    }

    return null;
}

function isSafePreviewUrl(value) {
    const normalized = String(value || '')
        .replace(/[\u0000-\u001f\u007f]+/g, '')
        .trim();

    if (!normalized || normalized.startsWith('#')) return true;
    return /^data:image\/(?:gif|jpe?g|png|svg\+xml|webp);base64,/i.test(normalized);
}

function sanitizeCssText(cssText) {
    return String(cssText || '')
        .replace(/@import\s+[^;]+;?/gi, '')
        .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote, url) =>
            isSafePreviewUrl(url) ? match : ''
        )
        .replace(/expression\s*\([^)]*\)/gi, '')
        .replace(/-moz-binding\s*:[^;]+;?/gi, '')
        .replace(/javascript\s*:/gi, '');
}

function sanitizePreviewElement(element, kind) {
    const tagName = element.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tagName) || (kind === 'svg' && tagName === 'foreignobject')) {
        element.remove();
        return;
    }

    Array.from(element.attributes || []).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on') || BLOCKED_ATTRS.has(attrName)) {
            element.removeAttribute(attr.name);
            return;
        }

        if (URI_ATTRS.has(attrName) && !isSafePreviewUrl(attr.value)) {
            element.removeAttribute(attr.name);
            return;
        }

        if (attrName === 'style') {
            const sanitizedStyle = sanitizeCssText(attr.value);
            if (sanitizedStyle.trim()) {
                element.setAttribute(attr.name, sanitizedStyle);
            } else {
                element.removeAttribute(attr.name);
            }
        }
    });

    if (tagName === 'style') {
        element.textContent = sanitizeCssText(element.textContent || '');
    }
}

function sanitizePreviewContainer(container, kind) {
    Array.from(container.querySelectorAll('*')).forEach((element) =>
        sanitizePreviewElement(element, kind)
    );
}

export function sanitizeArtifactMarkup(markup, kind = 'html') {
    if (typeof document === 'undefined') return escapeHtml(markup);

    const source = String(markup || '');
    if (kind === 'html') {
        const parsed = new DOMParser().parseFromString(source, 'text/html');
        sanitizePreviewContainer(parsed, 'html');

        const styleHtml = Array.from(parsed.head.querySelectorAll('style'))
            .map((style) => style.outerHTML)
            .join('');
        return `${styleHtml}${parsed.body.innerHTML}`.trim();
    }

    const template = document.createElement('template');
    template.innerHTML = source;
    sanitizePreviewContainer(template.content, 'svg');
    const svg = template.content.querySelector('svg');
    return svg ? svg.outerHTML : template.innerHTML.trim();
}

export function buildArtifactSrcDoc(kind, code) {
    const sanitizedMarkup = sanitizeArtifactMarkup(code, kind);
    const bodyClass = kind === 'svg' ? 'artifact-svg' : 'artifact-html';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'">
<style>
html,body{min-height:100%;margin:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{box-sizing:border-box;overflow:auto}
body.artifact-html{padding:16px}
body.artifact-svg{display:grid;place-items:center;padding:16px}
*,*::before,*::after{box-sizing:border-box}
img,svg,canvas,video{max-width:100%}
svg{height:auto}
</style>
</head>
<body class="${bodyClass}">${sanitizedMarkup}</body>
</html>`;
}

async function loadMermaidModule() {
    if (!mermaidModulePromise) {
        mermaidModulePromise = mermaidLoader().then((module) => module.default || module);
    }
    return mermaidModulePromise;
}

async function renderMermaidToSvg(code) {
    const mermaid = await loadMermaidModule();
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        fontFamily: 'inherit',
    });

    const result = await mermaid.render(createPrefixedId('mermaid_svg'), code);
    return result?.svg || '';
}

function setPreviewError(body, message) {
    body.classList.remove('live-artifact-body-loading');
    body.removeAttribute('aria-busy');
    body.innerHTML = '';

    const error = document.createElement('div');
    error.className = 'live-artifact-error';
    error.textContent = message || t('liveArtifactPreviewFailed');
    body.appendChild(error);
}

function renderMermaidPreview(body, code, renderMermaid = renderMermaidToSvg) {
    body.classList.add('live-artifact-body-loading');
    body.setAttribute('aria-busy', 'true');
    body.textContent = t('liveArtifactRendering');

    Promise.resolve(renderMermaid(code))
        .then((svg) => {
            if (!body.isConnected) return;
            const sanitizedSvg = sanitizeArtifactMarkup(svg, 'svg');
            if (!sanitizedSvg) {
                setPreviewError(body, t('liveArtifactPreviewFailed'));
                return;
            }

            body.classList.remove('live-artifact-body-loading');
            body.removeAttribute('aria-busy');
            body.innerHTML = sanitizedSvg;
        })
        .catch((error) => {
            if (!body.isConnected) return;
            const errorMessage = error instanceof Error ? error.message : '';
            setPreviewError(body, errorMessage || t('liveArtifactPreviewFailed'));
        });
}

export function createLiveArtifactPreview(kind, code, options = {}) {
    const preview = document.createElement('section');
    preview.className = 'live-artifact-preview';
    preview.dataset.liveArtifactKind = kind;

    const header = document.createElement('div');
    header.className = 'live-artifact-header';

    const title = document.createElement('span');
    title.className = 'live-artifact-title';
    title.textContent = t('liveArtifactPreview');

    const badge = document.createElement('span');
    badge.className = 'live-artifact-badge';
    badge.textContent = kind.toUpperCase();

    header.appendChild(title);
    header.appendChild(badge);
    preview.appendChild(header);

    const body = document.createElement('div');
    body.className = `live-artifact-body live-artifact-body-${kind}`;
    preview.appendChild(body);

    if (kind === 'mermaid') {
        renderMermaidPreview(body, code, options.renderMermaid);
        return preview;
    }

    const frame = document.createElement('iframe');
    frame.className = 'live-artifact-frame';
    frame.title = `${t('liveArtifactPreviewTitle')} (${kind.toUpperCase()})`;
    frame.setAttribute('sandbox', '');
    frame.referrerPolicy = 'no-referrer';
    frame.loading = 'lazy';
    frame.srcdoc = buildArtifactSrcDoc(kind, code);
    body.appendChild(frame);

    return preview;
}

export function enhanceLiveArtifacts(root, options = {}) {
    if (!root || typeof document === 'undefined') return;

    const wrappers = root.matches?.('.code-block-wrapper')
        ? [root]
        : Array.from(root.querySelectorAll?.('.code-block-wrapper') || []);

    wrappers.forEach((wrapper) => {
        if (wrapper.dataset.liveArtifactEnhanced === 'true') return;

        const codeElement = wrapper.querySelector('pre code');
        const code = codeElement?.textContent || '';
        const kind = getArtifactKind(getCodeLanguage(wrapper), code);
        if (!kind) return;

        wrapper.dataset.liveArtifactEnhanced = 'true';
        wrapper.appendChild(createLiveArtifactPreview(kind, code, options));
    });
}

export function setMermaidLoaderForTest(loader) {
    mermaidLoader = typeof loader === 'function' ? loader : () => import('mermaid');
    mermaidModulePromise = null;
}
