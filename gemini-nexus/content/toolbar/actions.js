
// content/toolbar/actions.js

class ToolbarActions {
    constructor(uiController) {
        this.ui = uiController;
        this.lastRequest = null;
    }

    get t() {
        return window.GeminiToolbarStrings;
    }

    /**
     * Handles Image Prompts (Screenshot, OCR, Analysis)
     * @param {string} imgBase64 - Image Data URL
     * @param {object} rect - Display Position
     * @param {string} mode - 'ocr' | 'translate' | 'snip' | 'analyze' | 'upscale' | 'expand' | 'remove_text' | 'remove_bg' | 'remove_watermark'
     * @param {string} model - Model Name
     */
    async handleImagePrompt(imgBase64, rect, mode, model = "gemini-2.5-flash") {
        const t = this.t;
        let title, prompt, loadingMsg, inputVal;

        switch (mode) {
            case 'ocr':
                title = t.titles.ocr;
                prompt = t.prompts.ocr;
                loadingMsg = t.loading.ocr;
                inputVal = t.inputs.ocr;
                break;
            case 'translate':
                title = t.titles.translate;
                prompt = t.prompts.imageTranslate;
                loadingMsg = t.loading.translate;
                inputVal = t.inputs.translate;
                break;
            case 'analyze': // General Image Analysis (from Hover button)
                title = t.titles.analyze;
                prompt = t.prompts.analyze;
                loadingMsg = t.loading.analyze;
                inputVal = t.inputs.analyze;
                break;
            case 'upscale':
                title = t.titles.upscale;
                prompt = t.prompts.upscale;
                loadingMsg = t.loading.upscale;
                inputVal = t.inputs.upscale;
                break;
            case 'expand':
                title = t.titles.expand;
                prompt = t.prompts.expand;
                loadingMsg = t.loading.expand;
                inputVal = t.inputs.expand;
                break;
            case 'remove_text':
                title = t.titles.removeText;
                prompt = t.prompts.removeText;
                loadingMsg = t.loading.removeText;
                inputVal = t.inputs.removeText;
                break;
            case 'remove_bg':
                title = t.titles.removeBg;
                prompt = t.prompts.removeBg;
                loadingMsg = t.loading.removeBg;
                inputVal = t.inputs.removeBg;
                break;
            case 'remove_watermark':
                title = t.titles.removeWatermark;
                prompt = t.prompts.removeWatermark;
                loadingMsg = t.loading.removeWatermark;
                inputVal = t.inputs.removeWatermark;
                break;
            case 'snip': // Fallback / Generic Snip
            default:
                title = t.titles.snip;
                prompt = t.prompts.snipAnalyze;
                loadingMsg = t.loading.snip;
                inputVal = t.inputs.snip;
                break;
        }

        await this.ui.showAskWindow(rect, loadingMsg, title);
        this.ui.showLoading(loadingMsg);
        this.ui.setInputValue(inputVal);

        const msg = {
            action: "QUICK_ASK_IMAGE",
            url: imgBase64,
            text: prompt,
            model: model
        };
        
        this.lastRequest = msg;
        chrome.runtime.sendMessage(msg);
    }

    async handleQuickAction(actionType, selection, rect, model = "gemini-2.5-flash", mousePoint = null) {
        const t = this.t;
        let prompt, title, inputPlaceholder, loadingMsg;

        if (actionType === 'translate') {
            prompt = t.prompts.textTranslate(selection);
            title = t.titles.textTranslate;
            inputPlaceholder = t.inputs.textTranslate;
            loadingMsg = t.loading.translate;
        } else if (actionType === 'summarize') {
            prompt = t.prompts.summarize(selection);
            title = t.titles.summarize;
            inputPlaceholder = t.inputs.summarize;
            loadingMsg = t.loading.summarize;
        } else if (actionType === 'grammar') {
            prompt = t.prompts.grammar(selection);
            title = t.titles.grammar;
            inputPlaceholder = t.inputs.grammar;
            loadingMsg = t.loading.grammar;
        } else if (actionType === 'explain') {
            prompt = t.prompts.explain(selection);
            title = t.titles.explain;
            inputPlaceholder = t.inputs.explain;
            loadingMsg = t.loading.explain;
        } else {
             // Fallback
             prompt = selection;
             title = "AI";
             inputPlaceholder = "";
             loadingMsg = t.loading.analyze;
        }

        this.ui.hide();
        await this.ui.showAskWindow(rect, selection, title, mousePoint);
        this.ui.showLoading(loadingMsg);

        this.ui.setInputValue(inputPlaceholder);

        const msg = {
            action: "QUICK_ASK",
            text: prompt,
            model: model
        };

        this.lastRequest = msg;
        chrome.runtime.sendMessage(msg);
    }

    handleSubmitAsk(question, context, sessionId = null, model = "gemini-2.5-flash") {
        this.ui.showLoading();
        
        let prompt = question;
        let includePageContext = false;

        if (context === "__PAGE_CONTEXT_FORCE__") {
            includePageContext = true;
            context = null; 
        }

        if (context) {
            prompt = `Context:\n${context}\n\nQuestion: ${question}`;
        }
        
        const msg = {
            action: "QUICK_ASK",
            text: prompt,
            model: model,
            sessionId: sessionId,
            includePageContext: includePageContext
        };
        
        this.lastRequest = msg;
        chrome.runtime.sendMessage(msg);
    }
    
    handleRetry() {
        if (!this.lastRequest) return;
        
        const currentModel = this.ui.getSelectedModel();
        if (currentModel) {
            this.lastRequest.model = currentModel;
        }
        
        const loadingMsg = this.t.loading.regenerate;
        this.ui.showLoading(loadingMsg);
        chrome.runtime.sendMessage(this.lastRequest);
    }

    handleCancel() {
        chrome.runtime.sendMessage({ action: "CANCEL_PROMPT" });
    }

    handleContinueChat(sessionId) {
        chrome.runtime.sendMessage({ 
            action: "OPEN_SIDE_PANEL",
            sessionId: sessionId
        });
    }
}

// Export global for Content Script usage
window.GeminiToolbarActions = ToolbarActions;