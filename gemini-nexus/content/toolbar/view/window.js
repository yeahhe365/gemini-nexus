
// content/toolbar/view/window.js
(function() {
    const Utils = window.GeminiViewUtils;
    const ICONS = window.GeminiToolbarIcons;

    // Simple helper
    const isZh = navigator.language.startsWith('zh');
    const DEFAULT_TITLE = isZh ? "询问" : "Ask";

    /**
     * Sub-controller for the Ask Window
     */
    class WindowView {
        constructor(elements) {
            this.elements = elements;
            this.isPinned = false;
        }

        togglePin() {
            this.isPinned = !this.isPinned;
            return this.isPinned;
        }

        async show(rect, contextText, title, resetDrag = null, mousePoint = null) {
            if (!this.elements.askWindow) return;

            // Load and apply saved dimensions
            const stored = await chrome.storage.local.get('gemini_nexus_window_size');
            if (stored.gemini_nexus_window_size) {
                let { w, h } = stored.gemini_nexus_window_size;
                const maxW = window.innerWidth * 0.95; 
                const maxH = window.innerHeight * 0.95;
                if (w > maxW) w = maxW;
                if (h > maxH) h = maxH;
                this.elements.askWindow.style.width = `${w}px`;
                this.elements.askWindow.style.height = `${h}px`;
            }

            if (resetDrag) {
                 resetDrag();
                 this.undockWindow();
            }

            if (!this.isPinned || !this.elements.askWindow.classList.contains('visible')) {
                 if (resetDrag) resetDrag();
                 Utils.positionElement(this.elements.askWindow, rect, true, this.isPinned, mousePoint);
            }
            
            // Reset Content
            this.elements.windowTitle.textContent = title || DEFAULT_TITLE;
            if (contextText) {
                this.elements.contextPreview.textContent = contextText;
                this.elements.contextPreview.classList.remove('hidden');
            } else {
                this.elements.contextPreview.classList.add('hidden');
            }
            
            this.elements.askInput.value = '';
            this.elements.resultText.innerHTML = '';
            
            // Hide Footer initially
            if (this.elements.windowFooter) this.elements.windowFooter.classList.add('hidden');

            this.elements.askWindow.classList.add('visible');
            setTimeout(() => this.elements.askInput.focus(), 50);
        }

        hide() {
            if (this.elements.askWindow) this.elements.askWindow.classList.remove('visible');
        }

        showLoading(msg) {
            if (!this.elements.askWindow) return;
            
            if (msg) {
                this.elements.resultText.innerHTML = `<div style="color: #888; font-style: italic; margin-top: 10px;">${msg}</div>`;
            } else {
                this.elements.resultText.innerHTML = '';
            }
            
            // Show Footer with Stop button
            if (this.elements.windowFooter) this.elements.windowFooter.classList.remove('hidden');
            if (this.elements.footerStop) this.elements.footerStop.classList.remove('hidden');
            if (this.elements.footerActions) this.elements.footerActions.classList.add('hidden');
        }

        showResult(htmlContent, title, isStreaming = false) {
            if (!this.elements.askWindow) return;
            
            if (title) this.elements.windowTitle.textContent = title;
            
            const resultArea = this.elements.resultArea;
            let shouldScrollBottom = false;
            
            // Only auto-scroll to bottom during streaming
            if (resultArea && isStreaming) {
                const threshold = 50;
                const distanceToBottom = resultArea.scrollHeight - resultArea.scrollTop - resultArea.clientHeight;
                shouldScrollBottom = distanceToBottom <= threshold;
            }
            
            // Content is now always HTML rendered via Bridge (using marked/katex/highlight.js)
            this.elements.resultText.innerHTML = htmlContent;

            // Ensure Footer is visible
            if (this.elements.windowFooter) this.elements.windowFooter.classList.remove('hidden');

            this.updateStreamingState(isStreaming);

            if (!isStreaming && !htmlContent) {
                // Empty and not streaming
                if (this.elements.windowFooter) this.elements.windowFooter.classList.add('hidden');
            }

            if (resultArea) {
                if (isStreaming) {
                    if (shouldScrollBottom) {
                        resultArea.scrollTop = resultArea.scrollHeight;
                    }
                } else {
                    // Finished: Scroll to top
                    resultArea.scrollTop = 0;
                }
            }
        }

        updateStreamingState(isStreaming) {
            if (!this.elements.askWindow) return;
            
            if (isStreaming) {
                if (this.elements.footerStop) this.elements.footerStop.classList.remove('hidden');
                if (this.elements.footerActions) this.elements.footerActions.classList.add('hidden');
            } else {
                if (this.elements.footerStop) this.elements.footerStop.classList.add('hidden');
                if (this.elements.footerActions) this.elements.footerActions.classList.remove('hidden');
                // Reset Copy Icon
                if (this.elements.buttons.copy) this.elements.buttons.copy.innerHTML = ICONS.COPY;
            }
        }

        showError(text) {
             if (!this.elements.askWindow) return;
             
             // Render Error UI with Retry hint
             this.elements.resultText.innerHTML = `
                <div style="padding: 12px 0; color: #d93025;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span>Error</span>
                    </div>
                    <div style="font-size: 14px; line-height: 1.5; color: #1f1f1f;">
                        ${text}
                    </div>
                </div>
             `;

             // Show Footer with Actions (Retry is in footer-left)
             if (this.elements.windowFooter) this.elements.windowFooter.classList.remove('hidden');
             if (this.elements.footerStop) this.elements.footerStop.classList.add('hidden');
             if (this.elements.footerActions) this.elements.footerActions.classList.remove('hidden');
        }
        
        toggleCopyIcon(success) {
            if (!this.elements.buttons.copy) return;
            this.elements.buttons.copy.innerHTML = success ? ICONS.CHECK : ICONS.COPY;
        }

        setInputValue(text) {
            if (this.elements.askInput) this.elements.askInput.value = text;
        }

        dockWindow(side, top) {
            const el = this.elements.askWindow;
            if (!el) return;
            el.style.transform = '';
            el.setAttribute('data-dock', side);
            el.style.top = `${top}px`;
            if (side === 'left') {
                el.style.left = '0';
                el.style.right = 'auto';
            } else {
                el.style.left = 'auto';
                el.style.right = '0';
            }
        }

        undockWindow() {
            const el = this.elements.askWindow;
            if (el) {
                el.removeAttribute('data-dock');
                el.style.transform = '';
            }
        }

        get isDocked() {
            return this.elements.askWindow && this.elements.askWindow.hasAttribute('data-dock');
        }

        isVisible() {
            return (this.elements.askWindow && this.elements.askWindow.classList.contains('visible'));
        }

        isHost(target) {
            return (this.elements.askWindow && this.elements.askWindow.contains(target));
        }
    }

    window.GeminiViewWindow = WindowView;
})();