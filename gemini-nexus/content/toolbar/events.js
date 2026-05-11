
// content/toolbar/events.js
(function() {
    class ToolbarEvents {
        constructor(controller) {
            this.controller = controller;
            this.resizeObserver = null;
            this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
        }

        bind(elements, askWindow) {
            const { buttons, imageBtn, askInput, askModelSelect } = elements;

            // --- Toolbar Buttons ---
            // Use .actions property to access delegate
            this._add(buttons.copySelection, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'copy_selection'));
            this._add(buttons.ask, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'ask'));
            this._add(buttons.grammar, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'grammar'));
            this._add(buttons.translate, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'translate'));
            this._add(buttons.explain, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'explain'));
            this._add(buttons.summarize, 'mousedown', (e) => this.controller.actions.triggerAction(e, 'summarize'));

            // --- Image Button ---
            this._add(imageBtn, 'click', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.controller.handleImageClick();
            });
            this._add(imageBtn, 'mouseover', () => this.controller.handleImageHover(true));
            this._add(imageBtn, 'mouseout', () => this.controller.handleImageHover(false));

            // --- Image Menu Actions ---
            if (buttons.imageChat) {
                this._add(buttons.imageChat, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_chat');
                });
            }
            if (buttons.imageDescribe) {
                this._add(buttons.imageDescribe, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_describe');
                });
            }
            if (buttons.imageExtract) {
                this._add(buttons.imageExtract, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_extract');
                });
            }
            
            // --- Image Edit Actions ---
            if (buttons.imageRemoveBg) {
                this._add(buttons.imageRemoveBg, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_remove_bg');
                });
            }
            if (buttons.imageRemoveText) {
                this._add(buttons.imageRemoveText, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_remove_text');
                });
            }
            if (buttons.imageRemoveWatermark) {
                this._add(buttons.imageRemoveWatermark, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_remove_watermark');
                });
            }
            if (buttons.imageUpscale) {
                this._add(buttons.imageUpscale, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_upscale');
                });
            }
            if (buttons.imageExpand) {
                this._add(buttons.imageExpand, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.actions.triggerAction(e, 'image_expand');
                });
            }

            // --- Window Actions ---
            this._add(buttons.headerClose, 'click', (e) => this.controller.actions.cancelAsk(e));
            this._add(buttons.stop, 'click', (e) => this.controller.actions.stopAsk(e));

            if (buttons.continue) {
                this._add(buttons.continue, 'click', (e) => this.controller.actions.continueChat(e));
            }
            if (buttons.copy) {
                this._add(buttons.copy, 'click', (e) => this.controller.actions.copyResult(e));
            }
            if (buttons.retry) {
                this._add(buttons.retry, 'click', (e) => this.controller.actions.retryAsk(e));
            }
            if (buttons.insert) {
                this._add(buttons.insert, 'click', (e) => this.controller.actions.insertResult(e));
            }
            if (buttons.replace) {
                this._add(buttons.replace, 'click', (e) => this.controller.actions.replaceResult(e));
            }

            // --- Browser Control (UI Toggle) ---
            const browserControlBtn = askWindow ? askWindow.querySelector('#browser-control-btn') : null;
            if (browserControlBtn) {
                this._add(browserControlBtn, 'click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    browserControlBtn.classList.toggle('active');
                });
            }

            // --- Input ---
            this._add(askInput, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    this.controller.actions.submitAsk(e);
                }
                e.stopPropagation();
            });

            // --- Model Selection ---
            this._add(askModelSelect, 'change', (e) => {
                this.controller.handleModelChange(e.target.value);
                const Utils = window.GeminiViewUtils;
                if (Utils && Utils.resizeSelect) Utils.resizeSelect(e.target);
            });

            // Prevent event bubbling to page
            if (elements.askWindow) {
                this._add(elements.askWindow, 'mousedown', (e) => e.stopPropagation());
            }
            
            // Code Copy Delegation inside Result Area
            // Use .codeCopy property to access handler
            if (elements.resultText) {
                this._add(elements.resultText, 'click', (e) => this.controller.codeCopy.handle(e));
            }

            this._initResizeObserver(askWindow);

            // Bind Global Escape Key
            document.addEventListener('keydown', this.handleGlobalKeydown, true);
        }

        handleGlobalKeydown(e) {
            if (e.key === 'Escape') {
                if (this.controller.isWindowVisible()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.controller.actions.cancelAsk(e);
                } else if (this.controller.isVisible()) {
                    // Hides small toolbar (selection or image button)
                    this.controller.hide();
                    this.controller.hideImageButton();
                }
            }
        }

        _add(el, event, handler) {
            if (el) {
                el.addEventListener(event, handler);
            }
        }

        _initResizeObserver(targetElement) {
            if (!targetElement) return;

            this.resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (this.controller.isWindowVisible()) {
                        let width, height;
                        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
                            width = entry.borderBoxSize[0].inlineSize;
                            height = entry.borderBoxSize[0].blockSize;
                        } else {
                            width = entry.contentRect.width;
                            height = entry.contentRect.height;
                        }
                        
                        if (width > 50 && height > 50) {
                            this.controller.saveWindowDimensions(width, height);
                        }
                    }
                }
            });
            this.resizeObserver.observe(targetElement);
        }

        disconnect() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            document.removeEventListener('keydown', this.handleGlobalKeydown, true);
        }
    }

    window.GeminiToolbarEvents = ToolbarEvents;
})();