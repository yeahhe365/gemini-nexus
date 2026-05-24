// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindInputEvents } from './input_events.js';

let cleanupInputEvents = null;

function installInputDom() {
    document.body.innerHTML = `
        <div class="model-select-wrapper">
            <select id="model-select" class="model-native-select">
                <option value="a">Gemini A Preview</option>
                <option value="b">Gemini B Preview</option>
                <option value="c">Gemini C Preview</option>
            </select>
            <button id="model-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="model-picker-listbox">
                <span class="model-picker-current"></span>
            </button>
            <div id="model-picker-menu" hidden>
                <div id="model-picker-listbox" role="listbox"></div>
            </div>
        </div>
        <textarea id="prompt"></textarea>
        <button id="send"></button>
    `;
}

function createApp(overrides = {}) {
    return {
        handleModelChange: vi.fn(),
        handleSendMessage: vi.fn(),
        handleCancel: vi.fn(),
        isGenerating: false,
        ...overrides,
    };
}

function bindHarness(overrides = {}) {
    const app = createApp(overrides);
    const inputFn = document.getElementById('prompt');
    const sendBtn = document.getElementById('send');
    const ui = {
        inputFn,
        sendBtn,
        resizeModelSelect: vi.fn(),
    };

    cleanupInputEvents = bindInputEvents(app, ui);

    return {
        app,
        inputFn,
        modelSelect: document.getElementById('model-select'),
        sendBtn,
        ui,
    };
}

function createKeyboardEvent(key, options = {}) {
    return new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
    });
}

function createPasteEvent(text, options = {}) {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    const clipboardData = {
        files: options.files || [],
        items: options.items || [],
        getData: vi.fn((type) => (type === 'text/plain' ? text : '')),
    };

    Object.defineProperty(pasteEvent, 'clipboardData', {
        value: clipboardData,
    });

    return { pasteEvent, clipboardData };
}

describe('input events', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        installInputDom();
        window.requestAnimationFrame = (callback) => {
            callback();
            return 1;
        };
    });

    afterEach(() => {
        if (cleanupInputEvents) {
            cleanupInputEvents();
            cleanupInputEvents = null;
        }
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('routes printable keys from non-editable targets into the chat input', () => {
        const { inputFn } = bindHarness();
        const inputSpy = vi.fn();
        inputFn.addEventListener('input', inputSpy);

        const keyEvent = createKeyboardEvent('h');
        document.body.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(true);
        expect(inputFn.value).toBe('h');
        expect(inputFn.selectionStart).toBe(1);
        expect(document.activeElement).toBe(inputFn);
        expect(inputSpy).toHaveBeenCalledTimes(1);
    });

    it('leaves other editable targets alone', () => {
        const { inputFn } = bindHarness();
        document.body.insertAdjacentHTML('beforeend', '<input id="other-input">');
        const otherInput = document.getElementById('other-input');

        const keyEvent = createKeyboardEvent('x');
        otherInput.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(false);
        expect(inputFn.value).toBe('');
    });

    it('inserts global pasted text at the saved chat-input cursor', () => {
        const { inputFn } = bindHarness();
        const inputSpy = vi.fn();
        inputFn.addEventListener('input', inputSpy);
        inputFn.value = 'fo';
        inputFn.setSelectionRange(1, 1);

        const { pasteEvent, clipboardData } = createPasteEvent('XX');
        document.body.dispatchEvent(pasteEvent);

        expect(pasteEvent.defaultPrevented).toBe(true);
        expect(clipboardData.getData).toHaveBeenCalledWith('text/plain');
        expect(inputFn.value).toBe('fXXo');
        expect(inputFn.selectionStart).toBe(3);
        expect(document.activeElement).toBe(inputFn);
        expect(inputSpy).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate file pastes handled by the image manager', () => {
        const { inputFn } = bindHarness();
        const { pasteEvent } = createPasteEvent('caption', {
            items: [{ kind: 'file' }],
        });

        document.body.dispatchEvent(pasteEvent);

        expect(pasteEvent.defaultPrevented).toBe(false);
        expect(inputFn.value).toBe('');
    });

    it('does not steal paste events from editable targets', () => {
        const { inputFn } = bindHarness();
        document.body.insertAdjacentHTML('beforeend', '<textarea id="other-textarea"></textarea>');
        const otherTextarea = document.getElementById('other-textarea');

        const { pasteEvent } = createPasteEvent('hello');
        otherTextarea.dispatchEvent(pasteEvent);

        expect(pasteEvent.defaultPrevented).toBe(false);
        expect(inputFn.value).toBe('');
    });

    it('keeps global key and paste focus behavior disabled while a modal is visible', () => {
        const { inputFn } = bindHarness();
        document.body.insertAdjacentHTML(
            'beforeend',
            '<div class="settings-modal visible" role="dialog"></div>'
        );

        const keyEvent = createKeyboardEvent('z');
        document.body.dispatchEvent(keyEvent);

        const { pasteEvent } = createPasteEvent('paste');
        document.body.dispatchEvent(pasteEvent);

        expect(keyEvent.defaultPrevented).toBe(false);
        expect(pasteEvent.defaultPrevented).toBe(false);
        expect(inputFn.value).toBe('');
    });

    it('does not submit while an IME composition event is active', () => {
        const { app, inputFn } = bindHarness();
        inputFn.focus();

        const keyEvent = createKeyboardEvent('Enter', { isComposing: true });
        inputFn.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(false);
        expect(app.handleSendMessage).not.toHaveBeenCalled();
    });

    it('submits Enter from the chat input after composition has ended', () => {
        const { app, inputFn } = bindHarness();
        inputFn.focus();

        const keyEvent = createKeyboardEvent('Enter');
        inputFn.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(true);
        expect(app.handleSendMessage).toHaveBeenCalledTimes(1);
    });

    it('cancels generation with Escape from the chat input', () => {
        const { app, inputFn } = bindHarness({ isGenerating: true });
        inputFn.focus();

        const keyEvent = createKeyboardEvent('Escape');
        inputFn.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(true);
        expect(app.handleCancel).toHaveBeenCalledTimes(1);
    });

    it('cycles models with Tab from the textarea or any non-editable target', () => {
        const { app, inputFn, modelSelect } = bindHarness();
        inputFn.focus();

        const inputTabEvent = createKeyboardEvent('Tab');
        inputFn.dispatchEvent(inputTabEvent);

        expect(inputTabEvent.defaultPrevented).toBe(true);
        expect(modelSelect.value).toBe('b');
        expect(app.handleModelChange).toHaveBeenLastCalledWith('b');

        inputFn.blur();
        const globalTabEvent = createKeyboardEvent('Tab');
        document.body.dispatchEvent(globalTabEvent);
        vi.advanceTimersByTime(50);

        expect(globalTabEvent.defaultPrevented).toBe(true);
        expect(modelSelect.value).toBe('c');
        expect(app.handleModelChange).toHaveBeenLastCalledWith('c');
        expect(document.activeElement).toBe(inputFn);
    });

    it('focuses the chat input at the end with the explicit focus shortcut', () => {
        const { inputFn } = bindHarness();
        inputFn.value = 'draft';
        inputFn.setSelectionRange(1, 1);

        const keyEvent = createKeyboardEvent('p', { metaKey: true });
        document.body.dispatchEvent(keyEvent);

        expect(keyEvent.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(inputFn);
        expect(inputFn.selectionStart).toBe(5);
    });
});
