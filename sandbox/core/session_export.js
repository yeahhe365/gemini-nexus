const EXPORT_TYPE = 'GeminiNexus-Chat';

function cloneJsonSafe(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function translate(t, key, fallback) {
    const value = typeof t === 'function' ? t(key) : key;
    return value && value !== key ? value : fallback;
}

export function sanitizeExportFilename(value) {
    const clean = String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 80)
        .trim();
    return clean || 'chat';
}

export function buildSessionExportFilename(session, format, date = new Date()) {
    const title = sanitizeExportFilename(session?.title || 'chat');
    const stamp = date.toISOString().slice(0, 10);
    return `gemini-nexus-${title}-${stamp}.${format}`;
}

export function serializeSessionForExport(session, exportedAt = new Date().toISOString()) {
    const clonedSession = cloneJsonSafe(session || {}) || {};
    clonedSession.context = null;

    return {
        type: EXPORT_TYPE,
        version: 1,
        exportedAt,
        session: clonedSession,
    };
}

function formatAttachmentList(message) {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    if (attachments.length > 0) {
        return attachments.map((attachment, index) => {
            const name = attachment?.name || `attachment-${index + 1}`;
            const type = attachment?.type ? ` (${attachment.type})` : '';
            return `- ${name}${type}`;
        });
    }

    const images = Array.isArray(message?.image) ? message.image : [];
    return images.map((image, index) => {
        const mime = typeof image === 'string' ? image.match(/^data:([^;]+);/)?.[1] : '';
        const type = mime ? ` (${mime})` : '';
        return `- image-${index + 1}${type}`;
    });
}

function formatGeneratedImages(message) {
    const images = Array.isArray(message?.generatedImages) ? message.generatedImages : [];
    return images.map((image, index) => {
        if (typeof image === 'string') return `- ${image}`;
        const label = image?.alt || `image-${index + 1}`;
        return image?.url ? `- ${label}: ${image.url}` : `- ${label}`;
    });
}

function formatSources(message) {
    const sources = Array.isArray(message?.sources) ? message.sources : [];
    return sources.map((source, index) => {
        const title = source?.title || source?.name || `source-${index + 1}`;
        return source?.url ? `- ${title}: ${source.url}` : `- ${title}`;
    });
}

export function buildSessionTextExport(
    session,
    { t, labels = {}, exportedAt = new Date().toISOString() } = {}
) {
    const lines = [];
    const userRole = labels.userRole || translate(t, 'exportRoleUser', 'User');
    const assistantRole = labels.assistantRole || translate(t, 'exportRoleAssistant', 'Assistant');
    const titleLabel = labels.title || translate(t, 'exportTitle', 'Title');
    const exportedAtLabel = labels.exportedAt || translate(t, 'exportedAt', 'Exported at');
    const messagesLabel = labels.messages || translate(t, 'exportMessages', 'Messages');
    const attachmentsLabel = labels.attachments || translate(t, 'exportAttachments', 'Attachments');
    const generatedImagesLabel =
        labels.generatedImages || translate(t, 'exportGeneratedImages', 'Generated images');
    const sourcesLabel = labels.sources || translate(t, 'exportSources', 'Sources');
    const thoughtsLabel = labels.thoughts || translate(t, 'exportThoughts', 'Thoughts');

    lines.push(`${titleLabel}: ${session?.title || 'Untitled'}`);
    lines.push(`${exportedAtLabel}: ${exportedAt}`);
    lines.push('');
    lines.push(messagesLabel);
    lines.push('='.repeat(messagesLabel.length));

    const messages = Array.isArray(session?.messages) ? session.messages : [];
    messages.forEach((message, index) => {
        const role = message?.role === 'user' ? userRole : assistantRole;
        lines.push('');
        lines.push(`[${index + 1}] ${role}`);
        lines.push('-'.repeat(`[${index + 1}] ${role}`.length));

        const text = typeof message?.text === 'string' ? message.text.trim() : '';
        if (text) {
            lines.push(text);
        }

        const attachments = formatAttachmentList(message);
        if (attachments.length > 0) {
            lines.push('');
            lines.push(`${attachmentsLabel}:`);
            lines.push(...attachments);
        }

        const generatedImages = formatGeneratedImages(message);
        if (generatedImages.length > 0) {
            lines.push('');
            lines.push(`${generatedImagesLabel}:`);
            lines.push(...generatedImages);
        }

        const sources = formatSources(message);
        if (sources.length > 0) {
            lines.push('');
            lines.push(`${sourcesLabel}:`);
            lines.push(...sources);
        }

        if (message?.thoughts) {
            lines.push('');
            lines.push(`${thoughtsLabel}:`);
            lines.push(String(message.thoughts).trim());
        }
    });

    return `${lines.join('\n')}\n`;
}
