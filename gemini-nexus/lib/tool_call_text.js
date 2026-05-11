const TOOL_KEY_PATTERN = /"tool"\s*:/g;
const FENCE_LINE_PATTERN = /`{3,}[ \t]*(?:json)?[ \t]*/iy;
const FENCE_OPEN_PATTERN = /^`{3,}[ \t]*(?:json)?\s*/i;
const FENCE_CLOSE_PATTERN = /\s*`{3,}\s*$/;
const PLACEHOLDER_TOOL_NAMES = new Set(['tool', 'tool_name', 'name', 'example_tool']);
const DEFAULT_MAX_UNCERTAIN_PREFIX_LENGTH = 160;

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(text) {
    try {
        const parsed = JSON.parse(text);
        return isPlainObject(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function isPlaceholderToolName(toolName) {
    const normalized = typeof toolName === 'string'
        ? toolName.trim().toLowerCase().replace(/[\s-]+/g, '_')
        : '';
    return !normalized || PLACEHOLDER_TOOL_NAMES.has(normalized);
}

function isCompleteToolCallObject(value) {
    return isPlainObject(value)
        && typeof value.tool === 'string'
        && !isPlaceholderToolName(value.tool)
        && isPlainObject(value.args);
}

function stripJsonFence(text) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    const opening = trimmed.match(FENCE_OPEN_PATTERN);
    if (!opening) return trimmed;

    const body = trimmed.slice(opening[0].length);
    const closing = body.match(FENCE_CLOSE_PATTERN);
    return closing ? body.slice(0, closing.index).trim() : body.trim();
}

export function parseToolCallObject(text) {
    const parsed = parseJsonObject(stripJsonFence(text));
    return isCompleteToolCallObject(parsed) ? parsed : null;
}

function isLikelyPartialToolCall(candidate) {
    const text = typeof candidate === 'string' ? stripJsonFence(candidate).trim() : '';
    if (!text || !text.startsWith('{')) return false;
    if (!/"tool"\s*:/.test(text)) return false;

    const toolMatch = text.match(/"tool"\s*:\s*"([^"]*)/);
    const hasToolString = Boolean(toolMatch && !isPlaceholderToolName(toolMatch[1]));
    const hasArgsKey = /"args"\s*:/.test(text);
    return hasToolString && hasArgsKey && !text.endsWith('}');
}

function getMaxUncertainPrefixLength(options = {}) {
    return Number.isFinite(options.maxUncertainPrefixLength)
        ? Math.max(0, options.maxUncertainPrefixLength)
        : DEFAULT_MAX_UNCERTAIN_PREFIX_LENGTH;
}

function isPotentialPartialToolCallPrefix(candidate, options = {}) {
    const rawText = typeof candidate === 'string' ? candidate : '';
    const text = stripJsonFence(rawText).trim();
    const isWithinUncertainBudget = rawText.length <= getMaxUncertainPrefixLength(options);

    if (!text || text === '```' || /^`{3,}[ \t]*(?:json)?$/i.test(text)) {
        return isWithinUncertainBudget;
    }
    if (!text.startsWith('{')) return false;

    const firstKeyMatch = text.match(/^\{\s*"([^"]*)"?/);
    if (firstKeyMatch && firstKeyMatch[1] && firstKeyMatch[1] !== 'tool') {
        return false;
    }

    if (!/"tool"\s*:/.test(text)) {
        return isWithinUncertainBudget && /^\{\s*(?:"t(?:o(?:o(?:l)?)?)?)?$/.test(text);
    }

    const toolMatch = text.match(/"tool"\s*:\s*"([^"]*)/);
    if (!toolMatch) {
        return isWithinUncertainBudget;
    }
    if (isPlaceholderToolName(toolMatch[1])) return false;

    const argsKeyMatch = text.match(/"args"\s*:/);
    if (argsKeyMatch) return true;

    const afterTool = text.slice(text.search(/"tool"\s*:/));
    const closedToolString = /"tool"\s*:\s*"[^"]+"\s*,/.test(afterTool);
    if (!closedToolString) return isWithinUncertainBudget;

    return isWithinUncertainBudget && /,\s*(?:"a(?:r(?:g(?:s)?)?)?)?$/.test(afterTool);
}

export function isToolCallCandidate(text, options = {}) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) return false;
    if (parseToolCallObject(trimmed)) return true;
    return options.allowPartial === true && isLikelyPartialToolCall(trimmed);
}

export function isToolCallOnlyText(text, options = {}) {
    return isToolCallCandidate(text, options);
}

function skipWhitespace(text, start) {
    let index = start;
    while (index < text.length && /\s/.test(text[index])) {
        index++;
    }
    return index;
}

function skipFenceMarkers(text, start) {
    let index = start;
    let changed = true;

    while (changed) {
        changed = false;
        index = skipWhitespace(text, index);

        FENCE_LINE_PATTERN.lastIndex = index;
        const match = FENCE_LINE_PATTERN.exec(text);
        if (!match) continue;

        const after = FENCE_LINE_PATTERN.lastIndex;
        const next = text[after];
        if (next === undefined || next === '\n' || next === '\r' || /\s/.test(next) || next === '{') {
            index = after;
            changed = true;
        }
    }

    return index;
}

function skipClosingFenceMarkers(text, start) {
    let index = skipWhitespace(text, start);
    FENCE_LINE_PATTERN.lastIndex = index;
    const match = FENCE_LINE_PATTERN.exec(text);
    if (!match) return start;
    return FENCE_LINE_PATTERN.lastIndex;
}

function findMatchingJsonEnd(text, start) {
    if (text[start] !== '{') return -1;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index++) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return index + 1;
        }
    }

    return -1;
}

function readToolCallAt(text, start, options = {}) {
    const objectStart = skipFenceMarkers(text, start);

    if (text[objectStart] !== '{') {
        return null;
    }

    const objectEnd = findMatchingJsonEnd(text, objectStart);
    if (objectEnd === -1) {
        const suffix = text.slice(objectStart);
        if (options.allowPartial === true && (isLikelyPartialToolCall(suffix) || isPotentialPartialToolCallPrefix(suffix, options))) {
            return {
                start,
                end: text.length,
                objectStart,
                objectEnd: text.length,
                toolCallText: suffix.trim()
            };
        }
        return null;
    }

    const objectText = text.slice(objectStart, objectEnd);
    if (!parseToolCallObject(objectText)) {
        return null;
    }

    return {
        start,
        end: skipClosingFenceMarkers(text, objectEnd),
        objectStart,
        objectEnd,
        toolCallText: objectText.trim()
    };
}

function consumeLeadingToolCallSequence(text, options = {}) {
    let index = 0;
    let lastCall = null;
    let count = 0;

    while (index < text.length) {
        const next = readToolCallAt(text, index, options);
        if (!next) break;
        lastCall = next;
        count++;
        index = next.end;
    }

    if (!lastCall && options.allowPartial === true && isPotentialPartialToolCallPrefix(text.slice(index), options)) {
        return {
            start: 0,
            end: text.length,
            toolCallText: text.trim(),
            count: 1
        };
    }

    if (!lastCall) return null;

    if (options.allowPartial === true && index < text.length && isPotentialPartialToolCallPrefix(text.slice(index), options)) {
        return {
            start: 0,
            end: text.length,
            toolCallText: text.slice(index).trim() || lastCall.toolCallText,
            count: count + 1
        };
    }

    return {
        start: 0,
        end: index,
        toolCallText: lastCall.toolCallText,
        count
    };
}

function getLineBoundaryStarts(text) {
    const starts = [0];
    for (let index = 0; index < text.length; index++) {
        if (text[index] === '\n') {
            starts.push(index + 1);
        }
    }
    return starts;
}

function findTrailingToolCallSequence(text, options = {}) {
    const starts = getLineBoundaryStarts(text);
    let bestMatch = null;

    for (let i = starts.length - 1; i >= 0; i--) {
        const start = starts[i];
        const prefix = text.slice(0, start);
        if (prefix.trim() && !/\n\s*$/.test(prefix)) continue;

        const sequence = consumeLeadingToolCallSequence(text.slice(start), options);
        if (!sequence) continue;
        if (text.slice(start + sequence.end).trim()) continue;

        bestMatch = {
            start,
            end: text.length,
            toolCallText: sequence.toolCallText,
            count: sequence.count
        };
    }

    return bestMatch;
}

function findTrailingPartialToolCallPrefix(text, options = {}) {
    if (options.allowPartial !== true) return null;

    const starts = getLineBoundaryStarts(text);
    let bestMatch = null;

    for (let i = starts.length - 1; i >= 0; i--) {
        const start = starts[i];
        const prefix = text.slice(0, start);
        if (prefix.trim() && !/\n\s*$/.test(prefix)) continue;

        const suffix = text.slice(start);
        if (!isPotentialPartialToolCallPrefix(suffix, options)) continue;

        bestMatch = {
            start,
            end: text.length,
            toolCallText: stripJsonFence(suffix).trim() || suffix.trim(),
            count: 1
        };
    }

    return bestMatch;
}

export function splitToolCallFromText(text, options = {}) {
    const value = typeof text === 'string' ? text : '';
    if (!value.trim()) {
        return {
            displayText: value,
            toolCallText: '',
            hasToolCall: false
        };
    }

    const leading = consumeLeadingToolCallSequence(value, options);
    if (leading) {
        return {
            displayText: value.slice(leading.end).trimStart(),
            toolCallText: leading.toolCallText,
            hasToolCall: true
        };
    }

    const trailing = findTrailingToolCallSequence(value, options)
        || findTrailingPartialToolCallPrefix(value, options);
    if (!trailing) {
        return {
            displayText: value,
            toolCallText: '',
            hasToolCall: false
        };
    }

    return {
        displayText: value.slice(0, trailing.start).trimEnd(),
        toolCallText: trailing.toolCallText,
        hasToolCall: true
    };
}

function findFirstFencedToolCall(text) {
    const value = typeof text === 'string' ? text : '';
    const starts = getLineBoundaryStarts(value);

    for (const start of starts) {
        const markerStart = skipWhitespace(value, start);
        if (!value.startsWith('```', markerStart)) continue;

        const call = readToolCallAt(value, markerStart);
        if (!call) continue;

        const parsed = parseToolCallObject(value.slice(call.objectStart, call.objectEnd));
        if (parsed) return parsed;
    }

    return null;
}

function findLastBareToolCall(text) {
    const value = typeof text === 'string' ? text : '';
    const matches = [...value.matchAll(TOOL_KEY_PATTERN)];

    for (let i = matches.length - 1; i >= 0; i--) {
        const toolIndex = matches[i].index;
        const start = value.lastIndexOf('{', toolIndex);
        if (start === -1) continue;

        const objectEnd = findMatchingJsonEnd(value, start);
        if (objectEnd === -1) continue;

        const parsed = parseToolCallObject(value.slice(start, objectEnd));
        if (parsed) return parsed;
    }

    return null;
}

export function parseToolCommand(responseText) {
    const command = findFirstFencedToolCall(responseText) || findLastBareToolCall(responseText);
    if (!command) return null;
    return {
        name: command.tool,
        args: command.args
    };
}
