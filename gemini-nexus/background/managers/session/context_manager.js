// background/managers/session/context_manager.js
import { sendOfficialMessage } from '../../../services/providers/official.js';
import { sendOpenAIMessage } from '../../../services/providers/openai_compatible.js';
import { DEFAULT_CONTEXT_RECENT_TURNS } from '../../../lib/constants.js';
import { getSessionContextSummary, updateSessionContextSummary } from '../history_manager.js';

const DEFAULT_CONTEXT_MODE = 'summary';
const MIN_RECENT_TURNS = 1;
const MAX_RECENT_TURNS = 50;
const MAX_SUMMARY_MESSAGE_CHARS = 4000;
const MAX_SUMMARY_TRANSCRIPT_CHARS = 60000;
const HIDDEN_COMPRESSED_MESSAGE_ROLE = 'user';
const HIDDEN_COMPRESSED_MESSAGE_PREFIX = '[Hidden compressed conversation history]\n';

const COMPRESSION_SYSTEM_PROMPT = `You maintain a compact hidden conversation history message for Gemini Nexus.

Rewrite the supplied hidden compressed history message and conversation segment into one updated hidden history message.

Keep durable information only:
- user goals, requirements, preferences, and constraints
- decisions already made
- important facts, file paths, URLs, code identifiers, errors, and fixes
- unresolved tasks or follow-up items

Discard small talk, duplicate details, transient wording, and anything already obsolete.
Return only the updated hidden history message. Use the user's language when possible.`;

function normalizeContextMode(mode) {
    return mode === 'recent' ? 'recent' : DEFAULT_CONTEXT_MODE;
}

function normalizeRecentTurns(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTEXT_RECENT_TURNS;
    return Math.min(MAX_RECENT_TURNS, Math.max(MIN_RECENT_TURNS, parsed));
}

function isHiddenCompressedMessage(message) {
    return typeof message?.text === 'string'
        && message.text.startsWith(HIDDEN_COMPRESSED_MESSAGE_PREFIX);
}

function isToolOutputMessage(message) {
    return message?.kind === 'tool-output'
        || (typeof message?.text === 'string' && message.text.startsWith('[Tool Output:'));
}

function isOfficialFunctionResponseMessage(message) {
    return message?.role === 'user'
        && message?.officialContent?.role === 'user'
        && Array.isArray(message.officialContent.parts)
        && message.officialContent.parts.some(part => part?.functionResponse);
}

function isConversationUserTurn(message) {
    return message?.role === 'user'
        && !isToolOutputMessage(message)
        && !isHiddenCompressedMessage(message)
        && !isOfficialFunctionResponseMessage(message);
}

function getRecentCutoff(messages, recentTurns) {
    if (!Array.isArray(messages) || messages.length === 0) return 0;

    let userTurns = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (isConversationUserTurn(messages[i])) {
            userTurns++;
            if (userTurns === recentTurns) {
                return i;
            }
        }
    }

    return 0;
}

function countUserTurns(messages) {
    if (!Array.isArray(messages)) return 0;
    return messages.reduce((count, message) => isConversationUserTurn(message) ? count + 1 : count, 0);
}

function hasRecentTurnThreshold(messages, recentTurns) {
    return countUserTurns(messages) >= recentTurns;
}

function getSummaryBoundary(summary, historyLength) {
    if (!summary?.text || !Number.isInteger(summary.sourceMessageCount)) return 0;
    if (summary.sourceMessageCount <= 0 || summary.sourceMessageCount > historyLength) return 0;
    return summary.sourceMessageCount;
}

function compactText(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= MAX_SUMMARY_MESSAGE_CHARS) return value;
    return `${value.slice(0, MAX_SUMMARY_MESSAGE_CHARS)}...`;
}

function describeAttachments(message) {
    const markers = [];
    if (Array.isArray(message?.image) && message.image.length > 0) {
        markers.push(`[${message.image.length} image attachment(s)]`);
    }
    if (Array.isArray(message?.generatedImages) && message.generatedImages.length > 0) {
        markers.push(`[${message.generatedImages.length} generated image(s)]`);
    }
    if (Array.isArray(message?.sources) && message.sources.length > 0) {
        markers.push(`[${message.sources.length} source link(s)]`);
    }
    return markers.length > 0 ? ` ${markers.join(' ')}` : '';
}

function formatMessagesForSummary(messages) {
    const lines = [];
    let total = 0;

    for (const message of messages) {
        const role = message?.role === 'ai' ? 'Assistant' : 'User';
        const text = compactText(message?.text);
        const line = `${role}: ${text || '[empty]'}${describeAttachments(message)}`;
        if (total + line.length > MAX_SUMMARY_TRANSCRIPT_CHARS) {
            lines.push('[Transcript truncated for summary budget]');
            break;
        }
        lines.push(line);
        total += line.length;
    }

    return lines.join('\n\n');
}

function normalizeCompressedMessageText(text) {
    let value = String(text || '').trim();
    while (value.startsWith(HIDDEN_COMPRESSED_MESSAGE_PREFIX.trim())) {
        value = value.slice(HIDDEN_COMPRESSED_MESSAGE_PREFIX.trim().length).trim();
    }
    return value;
}

function buildHiddenCompressedMessage(text) {
    const value = normalizeCompressedMessageText(text);
    return {
        role: HIDDEN_COMPRESSED_MESSAGE_ROLE,
        text: `${HIDDEN_COMPRESSED_MESSAGE_PREFIX}${value}`
    };
}

function buildCompressionPrompt(messages) {
    const transcript = formatMessagesForSummary(messages);

    return `Conversation history to compress:\n${transcript}\n\nUpdated hidden history message:`;
}

async function generateCompressedMessage(compressionPrompt, settings, signal) {
    const noop = () => {};

    if (settings.provider === 'official') {
        const response = await sendOfficialMessage(
            compressionPrompt,
            COMPRESSION_SYSTEM_PROMPT,
            [],
            {
                baseUrl: settings.officialBaseUrl,
                apiKey: settings.apiKey,
                model: settings.summaryModel || settings.officialModel?.split(',')?.[0]?.trim(),
                configuredModels: settings.officialModel
            },
            null,
            [],
            false,
            signal,
            noop
        );
        return response.text;
    }

    if (settings.provider === 'openai') {
        const response = await sendOpenAIMessage(
            compressionPrompt,
            COMPRESSION_SYSTEM_PROMPT,
            [],
            {
                baseUrl: settings.openaiBaseUrl,
                apiKey: settings.openaiApiKey,
                model: settings.summaryModel || settings.openaiModel?.split(',')?.[0]?.trim() || settings.openaiModel,
                reasoningEffort: settings.openaiThinkingLevel
            },
            [],
            signal,
            noop
        );
        return response.text;
    }

    return '';
}

async function resolveCompressedMessage(sessionId, messagesToCompress, sourceMessageCount, settings, signal, onStatus, existingSummary = null) {
    const existing = existingSummary || await getSessionContextSummary(sessionId);
    if (existing?.text && existing.sourceMessageCount === sourceMessageCount) {
        const normalizedText = normalizeCompressedMessageText(existing.text);
        if (sessionId && normalizedText !== existing.text) {
            await updateSessionContextSummary(sessionId, {
                ...existing,
                text: normalizedText
            });
        }
        return normalizedText;
    }

    if (!Array.isArray(messagesToCompress) || messagesToCompress.length === 0) {
        return existing?.text || '';
    }

    const compressionPrompt = buildCompressionPrompt(messagesToCompress);
    onStatus?.('compressing', {
        recentTurns: normalizeRecentTurns(settings.contextRecentTurns)
    });

    const text = normalizeCompressedMessageText(await generateCompressedMessage(compressionPrompt, settings, signal));
    if (!text) {
        onStatus?.('compression_failed', {
            recentTurns: normalizeRecentTurns(settings.contextRecentTurns)
        });
        throw new Error('Compression returned an empty response.');
    }

    if (sessionId) {
        await updateSessionContextSummary(sessionId, {
            text,
            sourceMessageCount,
            updatedAt: Date.now()
        });
    }

    onStatus?.('compressed', {
        recentTurns: normalizeRecentTurns(settings.contextRecentTurns)
    });

    return text;
}

export async function prepareManagedContext(request, settings, history, signal, onStatus = null) {
    const sourceHistory = Array.isArray(history) ? history : [];
    if (settings.provider === 'web' || sourceHistory.length === 0) {
        return {
            history: sourceHistory,
            systemInstruction: request.systemInstruction || ''
        };
    }

    const recentTurns = normalizeRecentTurns(settings.contextRecentTurns);
    const mode = normalizeContextMode(settings.contextMode);

    if (mode === 'recent') {
        const cutoff = getRecentCutoff(sourceHistory, recentTurns);
        const recentHistory = cutoff > 0 ? sourceHistory.slice(cutoff) : sourceHistory;
        return {
            history: recentHistory,
            systemInstruction: request.systemInstruction || ''
        };
    }

    const existingSummary = await getSessionContextSummary(request.sessionId);
    const existingBoundary = getSummaryBoundary(existingSummary, sourceHistory.length);

    if (existingBoundary > 0) {
        const tailHistory = sourceHistory.slice(existingBoundary);
        const hiddenHistory = buildHiddenCompressedMessage(existingSummary.text);

        if (!hasRecentTurnThreshold(tailHistory, recentTurns)) {
            return {
                history: [hiddenHistory, ...tailHistory],
                systemInstruction: request.systemInstruction || ''
            };
        }

        try {
            const compressedText = await resolveCompressedMessage(request.sessionId, [hiddenHistory, ...tailHistory], sourceHistory.length, {
                ...settings,
                summaryModel: request.model
            }, signal, onStatus, existingSummary);
            return {
                history: [buildHiddenCompressedMessage(compressedText)],
                systemInstruction: request.systemInstruction || ''
            };
        } catch (error) {
            console.warn('[Gemini Nexus] Failed to compress hidden history and tail, falling back to existing hidden history and unsummarized tail:', error);
            onStatus?.('compression_failed', {
                recentTurns
            });
            return {
                history: [hiddenHistory, ...tailHistory],
                systemInstruction: request.systemInstruction || ''
            };
        }
    }

    if (!hasRecentTurnThreshold(sourceHistory, recentTurns)) {
        return {
            history: sourceHistory,
            systemInstruction: request.systemInstruction || ''
        };
    }

    try {
        const compressedText = await resolveCompressedMessage(request.sessionId, sourceHistory, sourceHistory.length, {
            ...settings,
            summaryModel: request.model
        }, signal, onStatus);
        return {
            history: [buildHiddenCompressedMessage(compressedText)],
            systemInstruction: request.systemInstruction || ''
        };
    } catch (error) {
        console.warn('[Gemini Nexus] Failed to compress history, falling back to recent turns:', error);
        onStatus?.('compression_failed', {
            recentTurns
        });
        const cutoff = getRecentCutoff(sourceHistory, recentTurns);
        const recentHistory = cutoff > 0 ? sourceHistory.slice(cutoff) : sourceHistory;
        return {
            history: recentHistory,
            systemInstruction: request.systemInstruction || ''
        };
    }
}
