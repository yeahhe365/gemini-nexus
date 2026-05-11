
(function() {
    /**
     * Manages Grammar Correction Mode state and UI
     */
    class GeminiUIGrammar {
        constructor(view) {
            this.view = view;
            this.isGrammarMode = false;
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
        }

        setMode(enabled, sourceElement = null, selectionRange = null) {
            this.isGrammarMode = enabled;
            this.sourceInputElement = sourceElement;
            this.sourceSelectionRange = selectionRange;
        }

        reset() {
            this.isGrammarMode = false;
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
            this.toggleButtons(false);
        }

        getSourceInfo() {
            return {
                element: this.sourceInputElement,
                range: this.sourceSelectionRange
            };
        }

        // --- View Manipulation ---

        showTriggerButton(show) {
            const { buttons } = this.view.elements;
            if (buttons.grammar) {
                buttons.grammar.classList.toggle('hidden', !show);
            }
        }

        updateResultActions(isStreaming) {
            // Show Insert/Replace buttons after streaming is done in grammar mode
            if (!isStreaming && this.isGrammarMode && this.sourceInputElement) {
                this.toggleButtons(true);
            }
        }

        toggleButtons(show) {
            const { buttons } = this.view.elements;
            if (buttons.insert) {
                buttons.insert.classList.toggle('hidden', !show);
            }
            if (buttons.replace) {
                buttons.replace.classList.toggle('hidden', !show);
            }
        }
    }

    window.GeminiUIGrammar = GeminiUIGrammar;
})();
