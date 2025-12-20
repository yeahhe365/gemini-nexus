


// content/toolbar/ui.js (formerly content_toolbar_ui.js)

(function() {
    // Dependencies
    const Templates = window.GeminiToolbarTemplates;
    const View = window.GeminiToolbarView;
    const DragController = window.GeminiDragController;
    const Events = window.GeminiToolbarEvents;
    
    // Localization helper
    const isZh = navigator.language.startsWith('zh');
    const DEFAULT_TITLE = isZh ? "询问" : "Ask";

    /**
     * Main UI Controller
     */
    class ToolbarUI {
        constructor() {
            this.host = null;
            this.shadow = null;
            this.view = null;
            this.dragController = null;
            this.toolbarDragState = null; // State for toolbar dragging
            this.toolbarHasBeenDragged = false; // Track if toolbar was dragged by user
            this.events = null;
            this.callbacks = {};
            this.isBuilt = false;
            this.currentResultText = '';
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
            this.isGrammarMode = false;
            
            // Renderer properties
            this.rendererIframe = null;
            this.renderRequests = {};
            this.reqId = 0;
            this.latestRenderId = -1;
        }

        setCallbacks(callbacks) {
            this.callbacks = callbacks;
        }

        build() {
            if (this.isBuilt) return;
            this._createHost();
            this._initRenderer(); // Initialize background renderer
            this._render();
            this._loadMathLibs();
            
            // Initialize Sub-components
            this.view = new View(this.shadow);
            
            // Init Drag Controller with Docking Logic
            this.dragController = new DragController(
                this.view.elements.askWindow, 
                this.view.elements.askHeader,
                {
                    onSnap: (side, top) => this.view.dockWindow(side, top),
                    onUndock: () => this.view.undockWindow()
                }
            );

            this.events = new Events(this);

            // Bind Events
            this.events.bind(this.view.elements, this.view.elements.askWindow);

            // Init Toolbar Drag
            this._initToolbarDrag();

            this.isBuilt = true;
        }

        _createHost() {
            this.host = document.createElement('div');
            this.host.id = 'gemini-nexus-toolbar-host';
            Object.assign(this.host.style, {
                position: 'absolute', top: '0', left: '0', width: '0', height: '0',
                zIndex: '2147483647', pointerEvents: 'none'
            });
            document.documentElement.appendChild(this.host);
            this.shadow = this.host.attachShadow({ mode: 'closed' });
        }
        
        _initRenderer() {
            this.rendererIframe = document.createElement('iframe');
            this.rendererIframe.src = chrome.runtime.getURL('sandbox.html?mode=renderer');
            this.rendererIframe.style.display = 'none';
            // Append to main host (outside shadow) to ensure it loads
            this.host.appendChild(this.rendererIframe);
            
            window.addEventListener('message', (e) => {
                if (e.data.action === 'RENDER_RESULT') {
                    const { html, reqId } = e.data;
                    if (this.renderRequests[reqId]) {
                        this.renderRequests[reqId](html);
                        delete this.renderRequests[reqId];
                    }
                }
            });
        }
        
        async renderMarkdown(text) {
            const id = this.reqId++;
            return new Promise((resolve) => {
                this.renderRequests[id] = resolve;
                // Wait for iframe to be ready? Assuming it loads fast enough.
                if (this.rendererIframe.contentWindow) {
                     this.rendererIframe.contentWindow.postMessage({ action: 'RENDER', text, reqId: id }, '*');
                } else {
                     resolve(text); // Fallback
                }
            });
        }

        _render() {
            const container = document.createElement('div');
            container.innerHTML = Templates.mainStructure;
            this.shadow.appendChild(container);
        }

        _loadMathLibs() {
            // 1. Inject KaTeX CSS into Shadow DOM
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
            this.shadow.appendChild(link);

            const hljsLink = document.createElement('link');
            hljsLink.rel = 'stylesheet';
            hljsLink.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css';
            this.shadow.appendChild(hljsLink);
        }

        _initToolbarDrag() {
            const toolbar = this.view.elements.toolbar;
            const handle = this.view.elements.toolbarDragHandle;
            if (!toolbar || !handle) return;

            this.toolbarDragState = {
                isDragging: false,
                offsetX: 0,
                offsetY: 0
            };

            const onDragMove = (e) => {
                if (!this.toolbarDragState.isDragging) return;
                e.preventDefault();

                let clientX, clientY;
                if (e.type === 'touchmove') {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }

                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;

                const newLeft = clientX - this.toolbarDragState.offsetX + scrollX;
                const newTop = clientY - this.toolbarDragState.offsetY + scrollY;

                toolbar.style.left = `${newLeft}px`;
                toolbar.style.top = `${newTop}px`;
            };

            const onDragEnd = () => {
                if (!this.toolbarDragState.isDragging) return;
                this.toolbarDragState.isDragging = false;
                this.toolbarHasBeenDragged = true; // Mark as dragged to prevent repositioning
                toolbar.classList.remove('dragging');

                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('touchend', onDragEnd);
            };

            const startDrag = (clientX, clientY) => {
                this.toolbarDragState.isDragging = true;
                const rect = toolbar.getBoundingClientRect();

                this.toolbarDragState.offsetX = clientX - rect.left;
                this.toolbarDragState.offsetY = clientY - rect.top;

                toolbar.classList.add('dragging');

                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('touchend', onDragEnd);
            };

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startDrag(e.clientX, e.clientY);
            });

            handle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                startDrag(touch.clientX, touch.clientY);
            }, { passive: true });
        }

        // --- Event Handlers (Called by ToolbarEvents) ---

        triggerAction(e, action) {
            e.preventDefault(); e.stopPropagation();
            this._fireCallback('onAction', action);
        }

        handleImageClick() {
            this._fireCallback('onAction', 'image_analyze');
        }

        handleImageHover(isHovering) {
            this._fireCallback('onImageBtnHover', isHovering);
        }

        handleModelChange(model) {
            this._fireCallback('onModelChange', model);
        }

        cancelAsk(e) {
            e.preventDefault(); e.stopPropagation();
            this._fireCallback('onAction', 'cancel_ask');
        }

        retryAsk(e) {
            e.preventDefault(); e.stopPropagation();
            this._fireCallback('onAction', 'retry_ask');
        }

        continueChat(e) {
            e.preventDefault(); e.stopPropagation();
            this._fireCallback('onAction', 'continue_chat');
        }

        submitAsk(e) {
            const text = this.view.elements.askInput.value.trim();
            if (text) this._fireCallback('onAction', 'submit_ask', text);
        }

        async copyResult(e) {
            e.preventDefault(); e.stopPropagation();
            if (!this.currentResultText) return;
            try {
                await navigator.clipboard.writeText(this.currentResultText);
                this.view.toggleCopyIcon(true);
                setTimeout(() => this.view.toggleCopyIcon(false), 2000);
            } catch (err) {
                console.error("Failed to copy", err);
                this.view.showError("Copy failed.");
            }
        }

        insertResult(e) {
            e.preventDefault(); e.stopPropagation();
            if (!this.currentResultText) return;
            this._fireCallback('onAction', 'insert_result', this.currentResultText);
        }

        replaceResult(e) {
            e.preventDefault(); e.stopPropagation();
            if (!this.currentResultText) return;
            this._fireCallback('onAction', 'replace_result', this.currentResultText);
        }

        saveWindowDimensions(w, h) {
            chrome.storage.local.set({ 'gemini_nexus_window_size': { w, h } });
        }

        _fireCallback(type, ...args) {
            if (type === 'onImageBtnHover' && this.callbacks.onImageBtnHover) {
                this.callbacks.onImageBtnHover(...args);
            } else if (type === 'onModelChange' && this.callbacks.onModelChange) {
                this.callbacks.onModelChange(...args);
            } else if (this.callbacks.onAction) {
                this.callbacks.onAction(...args);
            }
        }

        // --- Public API ---

        show(rect, mousePoint) {
            // Skip repositioning if toolbar was dragged by user
            if (this.toolbarHasBeenDragged) {
                // Just ensure it's visible, don't reposition
                if (this.view.elements.toolbar) {
                    this.view.elements.toolbar.classList.add('visible');
                }
                return;
            }
            this.view.showToolbar(rect, mousePoint);
        }

        hide() {
            this.view.hideToolbar();
            // Reset dragged state when hiding
            this.toolbarHasBeenDragged = false;
        }

        showImageButton(rect) {
            this.view.showImageButton(rect);
        }

        hideImageButton() {
            this.view.hideImageButton();
        }

        showAskWindow(rect, contextText, title = DEFAULT_TITLE) {
            return this.view.showAskWindow(rect, contextText, title, () => this.dragController.reset());
        }

        showLoading(msg) {
            this.view.showLoading(msg);
        }

        async showResult(text, title, isStreaming) {
            this.currentResultText = text;
            const currentId = this.reqId; // Snapshot current request ID tracker if needed, but simplified:
            
            // Delegate rendering to iframe (Offscreen Renderer)
            const html = await this.renderMarkdown(text);
            
            // We only update if we are not stale? 
            // In streaming, we always want the latest.
            this.view.showResult(html, title, isStreaming, true);
            
            // Show Insert/Replace buttons after streaming is done in grammar mode
            if (!isStreaming && this.isGrammarMode && this.sourceInputElement) {
                this.showInsertReplaceButtons(true);
            }
        }

        showError(text) {
             this.view.showError(text);
        }

        hideAskWindow() {
            this.view.hideAskWindow();
            this.resetGrammarMode();
        }

        setInputValue(text) {
            this.view.setInputValue(text);
        }

        // --- Model Selection ---

        getSelectedModel() {
            return this.view ? this.view.getSelectedModel() : "gemini-2.5-flash";
        }

        setSelectedModel(model) {
            if (this.view) {
                this.view.setSelectedModel(model);
            }
        }

        setGrammarMode(enabled, sourceElement = null, selectionRange = null) {
            this.isGrammarMode = enabled;
            this.sourceInputElement = sourceElement;
            this.sourceSelectionRange = selectionRange;
        }

        resetGrammarMode() {
            this.isGrammarMode = false;
            this.sourceInputElement = null;
            this.sourceSelectionRange = null;
            this.showInsertReplaceButtons(false);
        }

        showInsertReplaceButtons(show) {
            const { buttons } = this.view.elements;
            if (buttons.insert) {
                buttons.insert.classList.toggle('hidden', !show);
            }
            if (buttons.replace) {
                buttons.replace.classList.toggle('hidden', !show);
            }
        }

        getSourceInfo() {
            return {
                element: this.sourceInputElement,
                range: this.sourceSelectionRange
            };
        }

        showGrammarButton(show) {
            const { buttons } = this.view.elements;
            if (buttons.grammar) {
                buttons.grammar.classList.toggle('hidden', !show);
            }
        }

        showCopySelectionFeedback(success) {
             this.view.toggleCopySelectionIcon(success);
             setTimeout(() => {
                 this.view.toggleCopySelectionIcon(null); 
             }, 2000);
        }

        isVisible() {
            if (!this.view) return false;
            return this.view.isToolbarVisible() || this.view.isWindowVisible();
        }

        isWindowVisible() {
            if (!this.view) return false;
            return this.view.isWindowVisible();
        }

        isHost(target) {
            if (!this.view) return false;
            return this.view.isHost(target, this.host);
        }
    }

    window.GeminiToolbarUI = ToolbarUI;

})();