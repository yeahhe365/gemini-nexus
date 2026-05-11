
// content/selection.js

(function() {
    class SelectionObserver {
        constructor(callbacks) {
            this.callbacks = callbacks || {}; // { onSelection, onClear, onClick }
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.init();
        }

        init() {
            document.addEventListener('mouseup', this.onMouseUp);
            document.addEventListener('mousedown', this.onMouseDown);
        }

        onMouseDown(e) {
            if (this.callbacks.onClick) {
                this.callbacks.onClick(e);
            }
        }

        onMouseUp(e) {
            // Capture coordinates immediately
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            // Delay slightly to let selection finalize (native behavior)
            setTimeout(() => {
                const selection = window.getSelection();
                const text = selection.toString().trim();

                if (text.length > 0) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    
                    if (this.callbacks.onSelection) {
                        this.callbacks.onSelection({
                            text,
                            range,
                            rect,
                            mousePoint: { x: mouseX, y: mouseY }
                        });
                    }
                } else {
                    if (this.callbacks.onClear) {
                        this.callbacks.onClear();
                    }
                }
            }, 10);
        }

        disconnect() {
            document.removeEventListener('mouseup', this.onMouseUp);
            document.removeEventListener('mousedown', this.onMouseDown);
        }
    }

    // Export to Window
    window.GeminiSelectionObserver = SelectionObserver;
})();
