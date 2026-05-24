// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { syncWebThinkingToggle } from './web_thinking_toggle.js';

function installButton() {
    document.body.innerHTML = `
        <button id="web-thinking-toggle" hidden aria-pressed="false"></button>
    `;
    return document.getElementById('web-thinking-toggle');
}

describe('web thinking toggle UI', () => {
    let button;

    beforeEach(() => {
        button = installButton();
    });

    it('shows the fast active state for Gemini Web Flash models', () => {
        syncWebThinkingToggle(
            button,
            { provider: 'web', webThinkingLevel: 'minimal' },
            '8c46e95b1a07cecc'
        );

        expect(button.hidden).toBe(false);
        expect(button.classList.contains('is-fast')).toBe(true);
        expect(button.dataset.thinkingLevel).toBe('minimal');
        expect(button.dataset.fastThinkingLevel).toBe('minimal');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.title).toBe('Thinking: Minimal (Fast Mode)');
    });

    it('uses low as the fast active state for Gemini Web Pro', () => {
        syncWebThinkingToggle(
            button,
            { provider: 'web', webThinkingLevel: 'low' },
            'e6fa609c3fa255c0'
        );

        expect(button.hidden).toBe(false);
        expect(button.classList.contains('is-fast')).toBe(true);
        expect(button.dataset.thinkingLevel).toBe('low');
        expect(button.dataset.fastThinkingLevel).toBe('low');
        expect(button.title).toBe('Thinking: Low (Fast Mode)');
    });

    it('hides outside the Gemini Web reverse provider', () => {
        syncWebThinkingToggle(
            button,
            { provider: 'official', webThinkingLevel: 'minimal' },
            '8c46e95b1a07cecc'
        );

        expect(button.hidden).toBe(true);
        expect(button.classList.contains('is-fast')).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });
});
