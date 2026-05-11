
// content/toolbar/utils/input.js
(function() {
    class InputManager {
        constructor() {
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
            this.sourceSelectionStart = null;
            this.sourceSelectionEnd = null;
        }

        capture() {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                if (start !== null && end !== null && start !== end) {
                    this.sourceInputElement = activeElement;
                    this.sourceSelectionRange = null;
                    this.sourceSelectionStart = start;
                    this.sourceSelectionEnd = end;
                    return;
                }
            }

            const selection = window.getSelection();
            if (!selection.rangeCount) {
                this._reset();
                return;
            }

            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;

            let editableElement = null;
            let node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

            while (node && node !== document.body) {
                if (node.isContentEditable) {
                    editableElement = node;
                    break;
                }
                node = node.parentElement;
            }

            if (editableElement) {
                this.sourceInputElement = editableElement;
                this.sourceSelectionRange = range.cloneRange();
                this.sourceSelectionStart = null;
                this.sourceSelectionEnd = null;
            } else {
                this._reset();
            }
        }

        insert(text, replace = false) {
            const element = this.sourceInputElement;
            const range = this.sourceSelectionRange;

            if (!element) return false;
            if (!text) return false;

            try {
                if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                    const start = this.sourceSelectionStart !== null ? this.sourceSelectionStart : 0;
                    const end = this.sourceSelectionEnd !== null ? this.sourceSelectionEnd : start;
                    const value = element.value;

                    element.focus();

                    if (replace) {
                        element.value = value.substring(0, start) + text + value.substring(end);
                        element.selectionStart = element.selectionEnd = start + text.length;
                    } else {
                        element.value = value.substring(0, end) + text + value.substring(end);
                        element.selectionStart = element.selectionEnd = end + text.length;
                    }

                    element.dispatchEvent(new Event('input', { bubbles: true }));

                } else if (element.isContentEditable) {
                    element.focus();

                    if (replace && range) {
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                        document.execCommand('insertText', false, text);
                    } else {
                        if (range) {
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            const endRange = range.cloneRange();
                            endRange.collapse(false);
                            selection.addRange(endRange);
                        }
                        document.execCommand('insertText', false, text);
                    }
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return true;
            } catch (err) {
                console.error("Failed to insert text:", err);
                return false;
            }
        }

        hasSource() {
            return !!this.sourceInputElement;
        }

        get source() {
            return this.sourceInputElement;
        }
        
        get range() {
            return this.sourceSelectionRange;
        }

        _reset() {
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
            this.sourceSelectionStart = null;
            this.sourceSelectionEnd = null;
        }
        
        reset() {
            this._reset();
        }
    }

    window.GeminiInputManager = InputManager;
})();
