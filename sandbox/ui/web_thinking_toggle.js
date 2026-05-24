import { DEFAULT_PROVIDER } from '../../shared/config/constants.js';
import {
    getWebThinkingFastLevel,
    normalizeWebThinkingLevelForModel,
    supportsWebThinking,
} from '../../shared/models/web_thinking.js';
import { t } from '../core/i18n.js';

function getProvider(settings = {}) {
    return settings.provider || (settings.useOfficialApi === true ? 'official' : DEFAULT_PROVIDER);
}

function updateButtonTitle(button, level, fastLevel) {
    const isFast = level === fastLevel;
    const title = isFast
        ? fastLevel === 'minimal'
            ? t('headerThinkingMinimalFastTitle')
            : t('headerThinkingLowFastTitle')
        : t('headerThinkingHighTitle');

    button.title = title;
    button.setAttribute('aria-label', t('headerThinkingToggleAria'));
    button.setAttribute('aria-pressed', isFast ? 'true' : 'false');
}

export function syncWebThinkingToggle(button, settings = {}, model) {
    if (!button) return false;

    const shouldShow = getProvider(settings) === 'web' && supportsWebThinking(model);
    button.hidden = !shouldShow;
    if (!shouldShow) {
        button.classList.remove('is-fast');
        button.removeAttribute('data-thinking-level');
        button.removeAttribute('data-fast-thinking-level');
        button.setAttribute('aria-pressed', 'false');
        return false;
    }

    const level = normalizeWebThinkingLevelForModel(model, settings.webThinkingLevel);
    const fastLevel = getWebThinkingFastLevel(model);
    const isFast = level === fastLevel;

    button.classList.toggle('is-fast', isFast);
    button.dataset.thinkingLevel = level;
    button.dataset.fastThinkingLevel = fastLevel;
    updateButtonTitle(button, level, fastLevel);
    return true;
}
