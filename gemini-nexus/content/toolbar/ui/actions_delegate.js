
(function() {
    /**
     * Handles specific UI actions triggered by user interaction.
     * Delegates actual logic execution or callback firing.
     */
    class ToolbarUIActions {
        constructor(uiManager) {
            this.manager = uiManager;
        }

        get view() { return this.manager.view; }
        get renderer() { return this.manager.renderer; }

        triggerAction(e, action) {
            e.preventDefault(); e.stopPropagation();
            this.manager.fireCallback('onAction', action);
        }

        cancelAsk(e) {
            e.preventDefault(); e.stopPropagation();
            this.manager.fireCallback('onAction', 'cancel_ask');
        }

        stopAsk(e) {
            e.preventDefault(); e.stopPropagation();
            this.manager.fireCallback('onAction', 'stop_ask');
        }

        retryAsk(e) {
            e.preventDefault(); e.stopPropagation();
            this.manager.fireCallback('onAction', 'retry_ask');
        }

        continueChat(e) {
            e.preventDefault(); e.stopPropagation();
            this.manager.fireCallback('onAction', 'continue_chat');
        }

        submitAsk(e) {
            const text = this.view.elements.askInput.value.trim();
            if (text) this.manager.fireCallback('onAction', 'submit_ask', text);
        }

        async copyResult(e) {
            e.preventDefault(); e.stopPropagation();
            const text = this.renderer ? this.renderer.currentText : '';
            if (!text) return;
            
            try {
                await navigator.clipboard.writeText(text);
                this.view.toggleCopyIcon(true);
                setTimeout(() => this.view.toggleCopyIcon(false), 2000);
            } catch (err) {
                console.error("Failed to copy", err);
                this.view.showError("Copy failed.");
            }
        }

        insertResult(e) {
            e.preventDefault(); e.stopPropagation();
            const text = this.renderer ? this.renderer.currentText : '';
            if (!text) return;
            this.manager.fireCallback('onAction', 'insert_result', text);
        }

        replaceResult(e) {
            e.preventDefault(); e.stopPropagation();
            const text = this.renderer ? this.renderer.currentText : '';
            if (!text) return;
            this.manager.fireCallback('onAction', 'replace_result', text);
        }
    }

    window.GeminiToolbarUIActions = ToolbarUIActions;
})();