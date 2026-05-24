import { getWebModelHeaderConfig } from './web_models.js';

export const DEFAULT_WEB_THINKING_LEVEL = 'high';
export const WEB_THINKING_LEVELS = Object.freeze(['minimal', 'low', 'medium', 'high']);

export function normalizeWebThinkingLevel(level, fallback = DEFAULT_WEB_THINKING_LEVEL) {
    const normalized = String(level || '')
        .trim()
        .toLowerCase();
    return WEB_THINKING_LEVELS.includes(normalized) ? normalized : fallback;
}

export function supportsWebThinking(model) {
    return Boolean(getWebModelHeaderConfig(model));
}

export function getWebThinkingFastLevel(model) {
    const config = getWebModelHeaderConfig(model);
    return normalizeWebThinkingLevel(config?.fastThinkingLevel, 'low');
}

export function normalizeWebThinkingLevelForModel(
    model,
    level,
    fallback = DEFAULT_WEB_THINKING_LEVEL
) {
    const normalized = normalizeWebThinkingLevel(level, fallback);
    if (normalized === 'minimal' && getWebThinkingFastLevel(model) !== 'minimal') {
        return 'low';
    }
    return normalized;
}

export function getNextWebThinkingLevel(model, currentLevel) {
    const normalized = normalizeWebThinkingLevelForModel(model, currentLevel);
    const fastLevel = getWebThinkingFastLevel(model);
    return normalized === fastLevel ? DEFAULT_WEB_THINKING_LEVEL : fastLevel;
}
