
// content/toolbar/dispatch.js

(function() {
    class ToolbarDispatcher {
        constructor(controller) {
            this.controller = controller;
        }

        // Accessors to controller components
        get ui() { return this.controller.ui; }
        get actions() { return this.controller.actions; }
        get inputManager() { return this.controller.inputManager; }
        get imageDetector() { return this.controller.imageDetector; }

        dispatch(actionType, data) {
            const currentModel = this.ui.getSelectedModel();

            switch(actionType) {
                case 'copy_selection':
                    if (this.controller.currentSelection) {
                        navigator.clipboard.writeText(this.controller.currentSelection)
                            .then(() => this.ui.showCopySelectionFeedback(true))
                            .catch((err) => {
                                console.error("Failed to copy text:", err);
                                this.ui.showCopySelectionFeedback(false);
                            });
                    }
                    break;
                
                case 'image_analyze':
                case 'image_chat':
                case 'image_describe':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;
                        
                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null; 
                        // Use unified handler with 'analyze' mode which prompts for description
                        this.actions.handleImagePrompt(imgUrl, rect, 'analyze', currentModel);
                    }
                    break;

                case 'image_extract':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;
                        
                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null; 
                        // Use 'ocr' mode to prompt for text extraction
                        this.actions.handleImagePrompt(imgUrl, rect, 'ocr', currentModel);
                    }
                    break;
                
                case 'image_remove_bg':
                case 'image_remove_text':
                case 'image_remove_watermark':
                case 'image_upscale':
                case 'image_expand':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;
                        
                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null; 
                        
                        let mode = 'remove_text';
                        if (actionType === 'image_upscale') mode = 'upscale';
                        if (actionType === 'image_remove_bg') mode = 'remove_bg';
                        if (actionType === 'image_remove_watermark') mode = 'remove_watermark';
                        if (actionType === 'image_expand') mode = 'expand';

                        this.actions.handleImagePrompt(imgUrl, rect, mode, currentModel);
                    }
                    break;

                case 'ask':
                    if (this.controller.currentSelection) {
                        this.controller.hide(); // Hides small toolbar
                        const isZh = navigator.language.startsWith('zh');
                        this.ui.showAskWindow(this.controller.lastRect, this.controller.currentSelection, isZh ? "询问" : "Ask Gemini", this.controller.lastMousePoint);
                        this.controller.visible = true; // Mark window as visible
                    }
                    break;
                
                case 'translate':
                case 'explain':
                case 'summarize':
                    if (!this.controller.currentSelection) return;
                    this.controller.lastSessionId = null;
                    this.actions.handleQuickAction(actionType, this.controller.currentSelection, this.controller.lastRect, currentModel, this.controller.lastMousePoint);
                    break;

                case 'grammar':
                    if (!this.controller.currentSelection) return;
                    this.ui.setGrammarMode(true, this.inputManager.source, this.inputManager.range);
                    this.controller.lastSessionId = null;
                    this.actions.handleQuickAction(actionType, this.controller.currentSelection, this.controller.lastRect, currentModel, this.controller.lastMousePoint);
                    break;

                case 'insert_result':
                    this._handleInsert(data, false);
                    break;

                case 'replace_result':
                    this._handleInsert(data, true);
                    break;

                case 'submit_ask':
                    const question = data;
                    const context = this.controller.currentSelection;
                    if (question) {
                        this.actions.handleSubmitAsk(question, context, this.controller.lastSessionId, currentModel);
                    }
                    break;

                case 'retry_ask':
                    this.actions.handleRetry();
                    break;

                case 'cancel_ask':
                    this.actions.handleCancel();
                    this.ui.hideAskWindow();
                    this.controller.visible = false;
                    this.controller.lastSessionId = null;
                    break;

                case 'stop_ask':
                    this.actions.handleCancel();
                    this.ui.stopLoading();
                    break;

                case 'continue_chat':
                    this.actions.handleContinueChat(this.controller.lastSessionId);
                    this.ui.hideAskWindow();
                    this.controller.visible = false;
                    this.controller.lastSessionId = null;
                    break;
            }
        }

        _handleInsert(text, replace) {
            if (!this.inputManager.hasSource()) {
                navigator.clipboard.writeText(text).then(() => {
                    this.ui.showError("Text copied to clipboard (not in editable field)");
                }).catch(() => {
                    this.ui.showError("Cannot insert: not in editable field");
                });
                return;
            }

            const success = this.inputManager.insert(text, replace);
            if (success) {
                this.ui.showInsertReplaceButtons(false);
            } else {
                this.ui.showError("Failed to insert text");
            }
        }
    }

    // Export to Window
    window.GeminiToolbarDispatcher = ToolbarDispatcher;
})();