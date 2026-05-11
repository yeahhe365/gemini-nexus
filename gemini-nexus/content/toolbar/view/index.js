
// content/toolbar/view/index.js
(function() {
    /**
     * Main View Facade
     * Orchestrates WidgetView and WindowView
     */
    class ToolbarView {
        constructor(shadowRoot) {
            this.shadow = shadowRoot;
            this.elements = {};
            this.cacheElements();
            
            // Initialize Sub-Views
            this.widgetView = new window.GeminiViewWidget(this.elements);
            this.windowView = new window.GeminiViewWindow(this.elements);
            
            // Initial resize of model select if exists
            const Utils = window.GeminiViewUtils;
            if (this.elements.askModelSelect && Utils && Utils.resizeSelect) {
                Utils.resizeSelect(this.elements.askModelSelect);
            }
        }

        cacheElements() {
            const get = (id) => this.shadow.getElementById(id);
            this.elements = {
                toolbar: get('toolbar'),
                toolbarDrag: get('toolbar-drag'),
                imageBtn: get('image-btn'),
                
                // New Window Elements
                askWindow: get('ask-window'),
                askHeader: get('ask-header'),
                windowTitle: get('window-title'),
                contextPreview: get('context-preview'),
                askInput: get('ask-input'),
                resultArea: get('result-area'),
                resultText: get('result-text'),
                askModelSelect: get('ask-model-select'),
                
                // Footer Elements
                windowFooter: get('window-footer'),
                footerActions: get('footer-actions'),
                footerStop: get('footer-stop'),
                
                // Buttons
                buttons: {
                    copySelection: get('btn-copy'),
                    ask: get('btn-ask'),
                    grammar: get('btn-grammar'),
                    translate: get('btn-translate'),
                    explain: get('btn-explain'),
                    summarize: get('btn-summarize'),
                    headerClose: get('btn-header-close'),
                    stop: get('btn-stop-gen'),
                    continue: get('btn-continue-chat'),
                    copy: get('btn-copy-result'),
                    retry: get('btn-retry'),
                    insert: get('btn-insert'),
                    replace: get('btn-replace'),
                    
                    // Image Menu Buttons
                    imageChat: get('btn-image-chat'),
                    imageDescribe: get('btn-image-describe'),
                    imageExtract: get('btn-image-extract'),
                    
                    // Image Edit Buttons
                    imageRemoveBg: get('btn-image-remove-bg'),
                    imageRemoveText: get('btn-image-remove-text'),
                    imageRemoveWatermark: get('btn-image-remove-watermark'),
                    imageUpscale: get('btn-image-upscale'),
                    imageExpand: get('btn-image-expand')
                }
            };
        }

        // --- Delegation to Widget View ---

        showToolbar(rect, mousePoint) { this.widgetView.showToolbar(rect, mousePoint); }
        hideToolbar() { this.widgetView.hideToolbar(); }
        showImageButton(rect) { this.widgetView.showImageButton(rect); }
        hideImageButton() { this.widgetView.hideImageButton(); }
        isToolbarVisible() { return this.widgetView.isToolbarVisible(); }
        toggleCopySelectionIcon(success) { this.widgetView.toggleCopySelectionIcon(success); }

        // --- Delegation to Window View ---

        get isPinned() { return this.windowView.isPinned; }
        get isDocked() { return this.windowView.isDocked; }
        
        togglePin() { return this.windowView.togglePin(); }
        showAskWindow(rect, contextText, title, resetDrag, mousePoint) { return this.windowView.show(rect, contextText, title, resetDrag, mousePoint); }
        hideAskWindow() { this.windowView.hide(); }
        showLoading(msg) { this.windowView.showLoading(msg); }
        
        // Pass optional isHtml flag
        showResult(text, title, isStreaming, isHtml = false) { 
            this.windowView.showResult(text, title, isStreaming, isHtml); 
        }
        
        updateStreamingState(isStreaming) { this.windowView.updateStreamingState(isStreaming); }

        showError(text) { this.windowView.showError(text); }
        toggleCopyIcon(success) { this.windowView.toggleCopyIcon(success); }
        setInputValue(text) { this.windowView.setInputValue(text); }
        isWindowVisible() { return this.windowView.isVisible(); }

        dockWindow(side, top) { this.windowView.dockWindow(side, top); }
        undockWindow() { this.windowView.undockWindow(); }

        // --- Model Selection ---
        
        getSelectedModel() {
            return this.elements.askModelSelect ? this.elements.askModelSelect.value : "gemini-2.5-flash";
        }

        setSelectedModel(model) {
            const Utils = window.GeminiViewUtils;
            if (this.elements.askModelSelect && model) {
                this.elements.askModelSelect.value = model;
                if(Utils && Utils.resizeSelect) Utils.resizeSelect(this.elements.askModelSelect);
            }
        }

        updateModelOptions(options, selectedValue) {
            const select = this.elements.askModelSelect;
            if (!select) return;

            select.innerHTML = '';
            options.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.val;
                opt.textContent = o.txt;
                select.appendChild(opt);
            });

            // Select value if valid, otherwise first option
            if (selectedValue && options.some(o => o.val === selectedValue)) {
                select.value = selectedValue;
            } else if (options.length > 0) {
                select.value = options[0].val;
            }
            
            const Utils = window.GeminiViewUtils;
            if (Utils && Utils.resizeSelect) Utils.resizeSelect(select);
        }

        // --- General ---

        isHost(target, host) {
            return target === host || this.windowView.isHost(target);
        }
    }

    window.GeminiToolbarView = ToolbarView;
})();