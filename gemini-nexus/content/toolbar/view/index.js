


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
                toolbarDragHandle: get('toolbar-drag-handle'),
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
                    replace: get('btn-replace')
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
        showAskWindow(rect, contextText, title, resetDrag) { return this.windowView.show(rect, contextText, title, resetDrag); }
        hideAskWindow() { this.windowView.hide(); }
        showLoading(msg) { this.windowView.showLoading(msg); }
        
        // Pass optional isHtml flag
        showResult(text, title, isStreaming, isHtml = false) { 
            this.windowView.showResult(text, title, isStreaming, isHtml); 
        }
        
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

        // --- General ---

        isHost(target, host) {
            return target === host || this.windowView.isHost(target);
        }
    }

    window.GeminiToolbarView = ToolbarView;
})();