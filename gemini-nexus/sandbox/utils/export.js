// sandbox/utils/export.js
// Session export utilities

/**
 * Convert a session to Markdown format
 * @param {Object} session - Session object with {id, title, timestamp, messages, context}
 * @returns {string} Markdown formatted text
 */
export function sessionToMarkdown(session) {
    if (!session) {
        return '';
    }

    const date = new Date(session.timestamp);
    const formattedDate = date.toLocaleString();

    let markdown = `# ${session.title}\n\n`;
    markdown += `**Exported:** ${formattedDate}\n`;
    markdown += `**Session ID:** ${session.id}\n\n`;

    if (session.context) {
        markdown += `**System Context:**\n\`\`\`\n${session.context}\n\`\`\`\n\n`;
    }

    markdown += `---\n\n`;

    // Add messages
    if (session.messages && session.messages.length > 0) {
        session.messages.forEach((msg, index) => {
            const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
            markdown += `## ${role}\n\n`;

            // Add thinking process if exists
            if (msg.thoughts) {
                markdown += `<details>\n<summary>💭 Thinking Process</summary>\n\n\`\`\`\n${msg.thoughts}\n\`\`\`\n</details>\n\n`;
            }

            // Add main text
            if (msg.text) {
                markdown += `${msg.text}\n\n`;
            }

            // Add user attached images
            if (msg.image) {
                markdown += `*[Image attached]*\n\n`;
            }

            // Add AI generated images
            if (msg.generatedImages && msg.generatedImages.length > 0) {
                markdown += `*[${msg.generatedImages.length} generated image(s)]*\n\n`;
            }

            markdown += `---\n\n`;
        });
    } else {
        markdown += `*No messages in this conversation*\n\n`;
    }

    markdown += `\n\n*Exported from Gemini Nexus*\n`;

    return markdown;
}

/**
 * Generate a safe filename from session title
 * @param {string} title - Session title
 * @param {number} timestamp - Session timestamp
 * @returns {string} Safe filename
 */
export function generateExportFilename(title, timestamp) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Sanitize title: remove special characters, keep alphanumeric, spaces, hyphens
    const safeTitle = title
        .replace(/[^a-zA-Z0-9\s\-\u4e00-\u9fa5]/g, '') // Keep alphanumeric, spaces, hyphens, Chinese characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .substring(0, 50); // Limit length

    return `gemini-nexus-${dateStr}-${safeTitle}.md`;
}

/**
 * Trigger download of session as markdown file
 * @param {Object} session - Session object
 */
export function exportSession(session) {
    if (!session) {
        console.error('[Export] No session provided');
        return;
    }

    const markdown = sessionToMarkdown(session);
    const filename = generateExportFilename(session.title, session.timestamp);

    // Use parent window's download mechanism
    window.parent.postMessage({
        action: 'DOWNLOAD_LOGS',
        payload: {
            text: markdown,
            filename: filename
        }
    }, '*');
}

/**
 * Export all sessions as a single markdown file
 * @param {Array} sessions - Array of session objects
 */
export function exportAllSessions(sessions) {
    if (!sessions || sessions.length === 0) {
        console.error('[Export] No sessions to export');
        return;
    }

    let markdown = `# Gemini Nexus - All Conversations Export\n\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Conversations:** ${sessions.length}\n\n`;
    markdown += `---\n\n`;

    sessions.forEach((session, index) => {
        markdown += `\n\n# Conversation ${index + 1}: ${session.title}\n\n`;
        markdown += `**Date:** ${new Date(session.timestamp).toLocaleString()}\n`;
        markdown += `**Messages:** ${session.messages ? session.messages.length : 0}\n\n`;
        markdown += `---\n\n`;

        if (session.messages && session.messages.length > 0) {
            session.messages.forEach((msg) => {
                const role = msg.role === 'user' ? '👤' : '🤖';
                markdown += `**${role}:** ${msg.text || '[No text]'}\n\n`;
            });
        }

        markdown += `\n\n`;
    });

    markdown += `\n\n*Exported from Gemini Nexus*\n`;

    const filename = `gemini-nexus-all-conversations-${new Date().toISOString().split('T')[0]}.md`;

    window.parent.postMessage({
        action: 'DOWNLOAD_LOGS',
        payload: {
            text: markdown,
            filename: filename
        }
    }, '*');
}
