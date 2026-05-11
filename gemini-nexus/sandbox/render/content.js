
// sandbox/render/content.js
import { transformMarkdown } from './pipeline.js';

const TOOL_OUTPUT_HEADER_PATTERN = /^\[Tool Output:\s*([^\]]+)\]\n?/;
const TOOL_STEP_FOOTER_PATTERN = /\n\n\[Proceeding to step\s+(\d+)\]\s*$/;
const TOOL_DISCLOSURE_PREFIX = 'tool-disclosure';
const TOOL_PREVIEW_KEYS = ['summary', 'message', 'error', 'result', 'text', 'title', 'name', 'url'];

function normalizeEscapedFenceMarkers(text) {
    return (text || '')
        .replace(/(?:\\+`){3}/g, '```')
        .replace(/&grave;/gi, '`')
        .replace(/&#96;/g, '`')
        .replace(/&Backtick;/gi, '`');
}

function stripOuterMarkdownFence(text) {
    const trimmed = normalizeEscapedFenceMarkers(text).trim();
    if (!trimmed) return '';

    const withoutOpening = trimmed.replace(/^```[ \t]*(?:json|javascript|js|text|txt)?(?:[ \t]*\r?\n|[ \t]+)?/i, '');
    return withoutOpening.replace(/\r?\n?[ \t]*```[\s\S]*$/i, '').trim();
}

function formatToolOutputBody(body) {
    const trimmed = stripOuterMarkdownFence(body);
    if (!trimmed) return '';

    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return trimmed;
    }
}

function formatToolCallText(text) {
    const trimmed = stripOuterMarkdownFence(text);
    if (!trimmed) return '';

    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return trimmed;
    }
}

function escapeFenceContent(text) {
    return (text || '').replace(/```/g, '``\\`');
}

function sanitizeToolName(toolName) {
    const raw = typeof toolName === 'string' ? toolName.trim() : '';
    if (!raw) return 'tool';

    const withoutRouting = raw.includes('__') ? raw.split('__').pop() : raw;
    const withoutPrefix = withoutRouting.replace(/^mcp[_-]+/i, '');
    const words = withoutPrefix
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_./:-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return words || 'tool';
}

function normalizeToolStatus(status) {
    const normalized = typeof status === 'string' ? status.toLowerCase() : '';
    if (['running', 'completed', 'failed', 'cancelled'].includes(normalized)) {
        return normalized;
    }
    return 'completed';
}

function getToolStatusCopy(status, displayName, hasOutput) {
    if (status === 'running') return `Using ${displayName}...`;
    if (status === 'failed') return `Failed ${displayName}`;
    if (status === 'cancelled') return `Cancelled ${displayName}`;
    return hasOutput ? `Used ${displayName}` : `Used ${displayName}`;
}

function getToolBadgeText(status) {
    if (status === 'running') return 'Running';
    if (status === 'failed') return 'Failed';
    if (status === 'cancelled') return 'Cancelled';
    return 'Done';
}

function parseToolOutputText(text) {
    const value = typeof text === 'string' ? text : '';
    const headerMatch = value.match(TOOL_OUTPUT_HEADER_PATTERN);
    const stepMatch = value.match(TOOL_STEP_FOOTER_PATTERN);
    const bodyStart = headerMatch ? headerMatch[0].length : 0;
    const bodyEnd = stepMatch ? value.length - stepMatch[0].length : value.length;

    return {
        toolName: headerMatch ? headerMatch[1].trim() : '',
        body: value.slice(bodyStart, bodyEnd),
        step: stepMatch ? stepMatch[1] : ''
    };
}

function getOutputPreview(text) {
    const trimmed = stripOuterMarkdownFence(text);
    if (!trimmed) return '';

    try {
        const parsed = JSON.parse(trimmed);
        const found = getStructuredPreviewValue(parsed);
        if (found !== undefined) {
            return truncatePreview(String(found));
        }
        if (parsed !== null && typeof parsed === 'object') {
            return getReadableJsonFallbackPreview(trimmed);
        }
    } catch (_) {
        // Invalid JSON-like output is handled below.
    }

    if (looksLikeJsonStructure(trimmed)) {
        const looseField = getLooseJsonFieldPreview(trimmed);
        if (looseField) {
            return truncatePreview(looseField);
        }

        return getReadableJsonFallbackPreview(trimmed);
    }

    return truncatePreview(trimmed);
}

function getStructuredPreviewValue(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
        for (const item of value) {
            const preview = getStructuredPreviewValue(item);
            if (preview !== undefined) return preview;
        }
        return undefined;
    }

    for (const key of TOOL_PREVIEW_KEYS) {
        if (!(key in value)) continue;
        const candidate = value[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
        if (candidate !== undefined && candidate !== null && typeof candidate !== 'object') return candidate;
    }

    return undefined;
}

function looksLikeJsonStructure(text) {
    const trimmed = (text || '').trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function getLooseJsonFieldPreview(text) {
    const candidates = [text, text.replace(/\\"/g, '"')];
    for (const key of TOOL_PREVIEW_KEYS) {
        const pattern = new RegExp(`["']${escapeRegExp(key)}["']\\s*:\\s*(["'])([\\s\\S]*?)\\1`, 'i');
        for (const candidate of candidates) {
            const match = candidate.match(pattern);
            if (match && match[2].trim()) {
                return decodeJsonLikeString(match[2].trim());
            }
        }
    }

    return '';
}

function getReadableJsonFallbackPreview(text) {
    const readable = (text || '')
        .replace(/^[\s,[{\]}:"]+/, '')
        .split('\n')
        .map(line => line.replace(/^[\s,[{\]}:"]+/, '').trim())
        .find(line => /[A-Za-z0-9\u4e00-\u9fff]/.test(line));

    if (!readable || /^[\s,[{\]}:,"]*$/.test(readable)) {
        return '';
    }

    return truncatePreview(readable);
}

function decodeJsonLikeString(value) {
    try {
        return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } catch {
        return value;
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncatePreview(text) {
    const collapsed = (text || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(' ');
    if (collapsed.length <= 180) return collapsed;
    return `${collapsed.slice(0, 177).trimEnd()}...`;
}

function createToolDisclosure(contentDiv, text, options = {}) {
    const parsed = parseToolOutputText(text);
    const rawToolName = options.toolName || parsed.toolName || '';
    const step = options.step || parsed.step || '';
    const callIndex = Number(options.callIndex);
    const callCount = Number(options.callCount);
    const status = normalizeToolStatus(options.toolStatus);
    const outputText = options.kind === 'tool-status' ? (text || '') : parsed.body;
    const formattedBody = formatToolOutputBody(outputText);
    const formattedToolCall = formatToolCallText(options.toolCallText);
    const preview = getOutputPreview(formattedBody);
    const displayName = sanitizeToolName(rawToolName);
    const regionId = `${TOOL_DISCLOSURE_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expanded = options.isCollapsed === false;
    const hasOutput = formattedBody.trim().length > 0;

    contentDiv.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = `tool-disclosure tool-disclosure-${status}`;
    wrapper.dataset.toolStatus = status;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tool-disclosure-toggle';
    toggle.setAttribute('aria-controls', regionId);

    const arrow = document.createElement('span');
    arrow.className = 'tool-disclosure-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';

    const main = document.createElement('span');
    main.className = 'tool-disclosure-main';

    const title = document.createElement('span');
    title.className = 'tool-disclosure-title';
    title.textContent = getToolStatusCopy(status, displayName, hasOutput);

    const badge = document.createElement('span');
    badge.className = 'tool-disclosure-badge';
    badge.textContent = getToolBadgeText(status);

    main.appendChild(title);
    main.appendChild(badge);

    if (preview) {
        const previewSpan = document.createElement('span');
        previewSpan.className = 'tool-disclosure-preview';
        previewSpan.textContent = preview;
        main.appendChild(previewSpan);
    }

    toggle.appendChild(arrow);
    toggle.appendChild(main);

    const body = document.createElement('div');
    body.id = regionId;
    body.className = 'tool-disclosure-body';

    if (rawToolName) {
        const meta = document.createElement('div');
        meta.className = 'tool-disclosure-meta';
        const metaParts = [`Raw tool: ${rawToolName}`];
        if (step) metaParts.push(`Step ${step}`);
        if (Number.isFinite(callIndex) && Number.isFinite(callCount) && callCount > 1) {
            metaParts.push(`Call ${callIndex}/${callCount}`);
        }
        meta.textContent = metaParts.join(' · ');
        body.appendChild(meta);
    }

    if (formattedToolCall) {
        const call = document.createElement('div');
        call.className = 'tool-call-body';
        call.innerHTML = transformMarkdown(`\`\`\`json\n${escapeFenceContent(formattedToolCall)}\n\`\`\``);
        body.appendChild(call);
    }

    if (hasOutput) {
        const output = document.createElement('div');
        output.className = 'tool-output-body';
        output.innerHTML = transformMarkdown(`\`\`\`json\n${escapeFenceContent(formattedBody)}\n\`\`\``);
        body.appendChild(output);
    }

    const setExpanded = (nextExpanded) => {
        wrapper.classList.toggle('tool-disclosure-expanded', nextExpanded);
        toggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
        toggle.setAttribute('aria-label', nextExpanded ? `Collapse ${displayName}` : `Expand ${displayName}`);
        body.hidden = !nextExpanded;
    };

    toggle.addEventListener('click', () => {
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });

    wrapper.appendChild(toggle);
    wrapper.appendChild(body);
    contentDiv.appendChild(wrapper);
    setExpanded(expanded);
}

// Helper: Render Markdown/Math/Text into an element
export function renderContent(contentDiv, text, role, options = {}) {
    if (role === 'tool-output' || role === 'tool-status') {
        createToolDisclosure(contentDiv, text, {
            ...options,
            kind: role
        });
        return;
    }

    // Render Markdown and Math for AI responses
    if (role === 'ai') {
        
        // Use shared pipeline
        const html = transformMarkdown(text);
        contentDiv.innerHTML = html;
        
        // Render Math (KaTeX Auto-render extension)
        // This processes the specific DOM element after HTML insertion
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(contentDiv, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        }
    } else {
        // User message OR fallback if marked not loaded yet
        contentDiv.innerText = text;
    }
}
