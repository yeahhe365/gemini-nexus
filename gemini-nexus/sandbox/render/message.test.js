// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendMessage } from './message.js';

vi.mock('./content.js', () => ({
    renderContent: vi.fn((contentDiv, text) => {
        contentDiv.textContent = text || '';
    })
}));

vi.mock('./clipboard.js', () => ({
    copyToClipboard: vi.fn()
}));

vi.mock('./generated_image.js', () => ({
    createGeneratedImage: vi.fn(() => document.createElement('img'))
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

describe('appendMessage copy button', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not show a copy button when a streaming AI update has no visible text', () => {
        const container = document.createElement('div');
        const controller = appendMessage(container, '', 'ai', null, '', null, {
            isStreaming: true,
            autoScroll: false
        });

        controller.update('', undefined, { isStreaming: true });

        expect(container.querySelector('.copy-btn')).toBeNull();
    });

    it('shows and removes the copy button as visible AI text appears and disappears', () => {
        const container = document.createElement('div');
        const controller = appendMessage(container, '', 'ai', null, '', null, {
            isStreaming: true,
            autoScroll: false
        });

        controller.update('Visible answer', undefined, { isStreaming: true });
        expect(container.querySelector('.copy-btn')).not.toBeNull();

        controller.update('', undefined, { isStreaming: true });
        expect(container.querySelector('.copy-btn')).toBeNull();
    });

    it('hides the copy button when an intermediate AI message suppresses copying', () => {
        const container = document.createElement('div');
        const controller = appendMessage(container, '', 'ai', null, 'thinking', null, {
            isStreaming: true,
            autoScroll: false
        });

        controller.update('I will call a tool now.', undefined, { isStreaming: true });
        expect(container.querySelector('.copy-btn')).not.toBeNull();

        controller.finalize('I will call a tool now.', undefined, { suppressCopy: true });
        expect(container.querySelector('.copy-btn')).toBeNull();
        expect(container.querySelector('.msg-content')?.textContent).toBe('I will call a tool now.');
    });
});
