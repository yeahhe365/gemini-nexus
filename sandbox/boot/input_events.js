import { resizeSelectToSelectedOption } from '../ui/model_select_width.js';
import { initModelPicker, syncModelPicker } from '../ui/model_picker.js';

const IME_PROCESS_KEY_CODE = 229;
const ACTIVE_MODAL_SELECTOR = [
    '.settings-modal.visible',
    '.settings-page.visible',
    '.image-viewer.visible',
    '[role="dialog"].visible',
    '[aria-modal="true"].visible',
].join(', ');

function isEditableTarget(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return false;

    const element = target;
    const tagName = element.tagName;

    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return true;
    }

    if (element.isContentEditable) {
        return true;
    }

    return Boolean(
        element.closest?.(
            '[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
        )
    );
}

function isImeEvent(keyEvent) {
    return (
        keyEvent.isComposing ||
        keyEvent.key === 'Process' ||
        keyEvent.keyCode === IME_PROCESS_KEY_CODE ||
        keyEvent.which === IME_PROCESS_KEY_CODE
    );
}

function hasActiveModal() {
    return Boolean(document.querySelector(ACTIVE_MODAL_SELECTOR));
}

function focusInputAtEnd(inputFn, delayMs = 0) {
    if (!inputFn) return;

    const focusNow = () => {
        inputFn.focus();
        const textLength = inputFn.value.length;
        inputFn.setSelectionRange?.(textLength, textLength);
        inputFn.scrollTop = inputFn.scrollHeight;
    };

    if (delayMs > 0) {
        setTimeout(focusNow, delayMs);
        return;
    }

    focusNow();
}

function insertTextAtCursor(inputFn, text) {
    if (!inputFn || !text) return;

    const startPos =
        typeof inputFn.selectionStart === 'number' ? inputFn.selectionStart : inputFn.value.length;
    const endPos = typeof inputFn.selectionEnd === 'number' ? inputFn.selectionEnd : startPos;

    inputFn.value =
        inputFn.value.slice(0, startPos) + text + inputFn.value.slice(endPos, inputFn.value.length);

    const nextPosition = startPos + text.length;
    inputFn.setSelectionRange?.(nextPosition, nextPosition);
    inputFn.dispatchEvent(new Event('input', { bubbles: true }));
    inputFn.focus();
}

function appendTypedKey(inputFn, key) {
    if (!inputFn || !key) return;

    inputFn.focus();
    inputFn.value += key;
    inputFn.dispatchEvent(new Event('input', { bubbles: true }));
    focusInputAtEnd(inputFn);
}

function clipboardHasFiles(clipboardData) {
    if (!clipboardData) return false;

    if (clipboardData.files && clipboardData.files.length > 0) {
        return true;
    }

    return Array.from(clipboardData.items || []).some((item) => item.kind === 'file');
}

function bindModelSelect(app, ui, setResizeRef, inputFn) {
    const modelSelect = document.getElementById('model-select');
    const modelPicker = initModelPicker(modelSelect);
    let resizeModelSelectFrame = null;
    const resizeModelSelect = () => {
        if (resizeModelSelectFrame !== null) return;

        resizeModelSelectFrame = window.requestAnimationFrame(() => {
            resizeModelSelectFrame = null;

            if (ui?.resizeModelSelect) {
                ui.resizeModelSelect();
                return;
            }

            resizeSelectToSelectedOption(modelSelect);
            syncModelPicker(modelSelect);
        });
    };

    if (setResizeRef) setResizeRef(resizeModelSelect);

    let cleanup = () => {};
    if (modelSelect) {
        const handleModelChange = (changeEvent) => {
            app.handleModelChange(changeEvent.target.value);
            modelPicker?.sync();
            resizeModelSelect();
            focusInputAtEnd(inputFn, 50);
        };

        modelSelect.addEventListener('change', handleModelChange);
        setTimeout(resizeModelSelect, 50);
        cleanup = () => modelSelect.removeEventListener('change', handleModelChange);
    }

    return { modelSelect, cleanup };
}

function cycleModelSelect(modelSelect, keyEvent, inputFn) {
    if (!modelSelect || modelSelect.length === 0) return;
    const direction = keyEvent.shiftKey ? -1 : 1;
    const newIndex =
        (modelSelect.selectedIndex + direction + modelSelect.length) % modelSelect.length;
    modelSelect.selectedIndex = newIndex;
    modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    focusInputAtEnd(inputFn, 50);
}

export function bindInputEvents(app, ui, setResizeRef) {
    const inputFn = ui?.inputFn || document.getElementById('prompt');
    const sendBtn = ui?.sendBtn || document.getElementById('send');
    const { modelSelect, cleanup: cleanupModelSelect } = bindModelSelect(
        app,
        ui,
        setResizeRef,
        inputFn
    );
    const cleanupHandlers = [cleanupModelSelect];

    if (inputFn && sendBtn) {
        const handleInputKeyDown = (keyEvent) => {
            if (isImeEvent(keyEvent)) {
                return;
            }

            if (keyEvent.key === 'Tab') {
                keyEvent.preventDefault();
                cycleModelSelect(modelSelect, keyEvent, inputFn);
                return;
            }

            if (keyEvent.key === 'Escape' && app.isGenerating) {
                keyEvent.preventDefault();
                app.handleCancel();
                return;
            }

            if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                keyEvent.preventDefault();
                sendBtn.click();
            }
        };

        const handleSendClick = () => {
            if (app.isGenerating) {
                app.handleCancel();
            } else {
                app.handleSendMessage();
            }
        };

        inputFn.addEventListener('keydown', handleInputKeyDown);
        sendBtn.addEventListener('click', handleSendClick);
        cleanupHandlers.push(() => inputFn.removeEventListener('keydown', handleInputKeyDown));
        cleanupHandlers.push(() => sendBtn.removeEventListener('click', handleSendClick));
    }

    const handleGlobalPaste = (pasteEvent) => {
        if (
            pasteEvent.defaultPrevented ||
            hasActiveModal() ||
            isEditableTarget(pasteEvent.target)
        ) {
            return;
        }

        const clipboardData = pasteEvent.clipboardData || pasteEvent.originalEvent?.clipboardData;
        if (!clipboardData || clipboardHasFiles(clipboardData)) {
            return;
        }

        const pastedText = clipboardData.getData('text/plain');
        if (!pastedText) {
            return;
        }

        pasteEvent.preventDefault();
        pasteEvent.stopPropagation();
        insertTextAtCursor(inputFn, pastedText);
    };

    const handleGlobalKeyDown = (keyEvent) => {
        if (keyEvent.defaultPrevented) {
            return;
        }

        if (isImeEvent(keyEvent)) {
            return;
        }

        if (hasActiveModal()) {
            return;
        }

        if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key.toLowerCase() === 'p') {
            keyEvent.preventDefault();
            focusInputAtEnd(inputFn);
            return;
        }

        if (keyEvent.key === 'Escape' && app.isGenerating) {
            keyEvent.preventDefault();
            app.handleCancel();
            return;
        }

        if (keyEvent.key === 'Tab' && !isEditableTarget(keyEvent.target)) {
            keyEvent.preventDefault();
            cycleModelSelect(modelSelect, keyEvent, inputFn);
            return;
        }

        if (
            isEditableTarget(keyEvent.target) ||
            keyEvent.ctrlKey ||
            keyEvent.metaKey ||
            keyEvent.altKey ||
            keyEvent.key.length !== 1
        ) {
            return;
        }

        keyEvent.preventDefault();
        appendTypedKey(inputFn, keyEvent.key);
    };

    document.addEventListener('paste', handleGlobalPaste);
    document.addEventListener('keydown', handleGlobalKeyDown);
    cleanupHandlers.push(() => document.removeEventListener('paste', handleGlobalPaste));
    cleanupHandlers.push(() => document.removeEventListener('keydown', handleGlobalKeyDown));

    return () => {
        cleanupHandlers.forEach((cleanup) => cleanup());
    };
}
