import { t } from '../core/i18n.js';
import { TemplateIcons } from '../ui/templates/icons.js';

export function configureMarkdown() {
    if (typeof marked === 'undefined') return;

    const renderer = new marked.Renderer();

    const escapeHtml = (text) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const normalizeCodeLanguage = (language) => {
        return String(language || '')
            .trim()
            .split(/\s+/)[0]
            .toLowerCase()
            .replace(/[^a-z0-9_+#.-]+/g, '')
            .slice(0, 48);
    };

    const toClassToken = (language) => {
        return String(language || 'plaintext')
            .replace(/[^a-z0-9_-]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);
    };

    renderer.code = function (codeOrToken, language) {
        let code = codeOrToken;
        let lang = language;

        // Handle Marked v13+ breaking change: renderer receives a token object as first argument
        if (typeof codeOrToken === 'object' && codeOrToken !== null) {
            code = codeOrToken.text || '';
            lang = codeOrToken.lang || '';
        }

        if (typeof code !== 'string' || code.trim().length === 0) {
            return '';
        }

        const codeLang = normalizeCodeLanguage(lang);
        const displayLang = codeLang || 'plaintext';
        const highlightLang =
            codeLang && typeof hljs !== 'undefined' && hljs.getLanguage(codeLang)
                ? codeLang
                : 'plaintext';
        const codeLangClass = toClassToken(displayLang);
        let highlighted;

        if (typeof hljs !== 'undefined' && highlightLang !== 'plaintext') {
            try {
                highlighted = hljs.highlight(code, { language: highlightLang }).value;
            } catch {
                // Fallback to manual escape if highlight fails
                highlighted = escapeHtml(code);
            }
        } else {
            // Manual escape for plaintext or if hljs is missing
            highlighted = escapeHtml(code);
        }

        const copyLabel = t('copy');
        const copyCodeLabel = t('copyCode');

        return `
<div class="code-block-wrapper" data-code-lang="${escapeHtml(displayLang)}">
    <div class="code-header">
        <span class="code-lang">${escapeHtml(displayLang)}</span>
        <button class="copy-code-btn" aria-label="${copyCodeLabel}">
            ${TemplateIcons.COPY}
            <span>${copyLabel}</span>
        </button>
    </div>
    <pre><code class="hljs language-${codeLangClass}">${highlighted}</code></pre>
</div>`;
    };

    const options = {
        breaks: true,
        gfm: true,
        renderer: renderer,
    };

    // Use marked.use() if available (v5+), otherwise fallback to setOptions (deprecated)
    if (typeof marked.use === 'function') {
        marked.use(options);
    } else if (typeof marked.setOptions === 'function') {
        marked.setOptions(options);
    }
}
