
// content/toolbar/view/widget.js
(function() {
    const Utils = window.GeminiViewUtils;

    /**
     * Sub-controller for Floating Toolbar and Image Button
     */
    class WidgetView {
        constructor(elements) {
            this.elements = elements;
        }

        showToolbar(rect, mousePoint) {
            if (!this.elements.toolbar) return;
            // Toolbar is never pinned, pass false
            Utils.positionElement(this.elements.toolbar, rect, false, false, mousePoint);
            this.elements.toolbar.classList.add('visible');
        }

        hideToolbar() {
            if (this.elements.toolbar) this.elements.toolbar.classList.remove('visible');
        }

        showImageButton(rect) {
            if (!this.elements.imageBtn) return;
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            
            // Position: Top-Left of image (with 10px padding)
            const left = rect.left + scrollX + 10; 
            const top = rect.top + scrollY + 10; 
            
            Object.assign(this.elements.imageBtn.style, { left: `${left}px`, top: `${top}px` });
            this.elements.imageBtn.classList.add('visible');
        }

        hideImageButton() {
            if (this.elements.imageBtn) this.elements.imageBtn.classList.remove('visible');
        }

        isToolbarVisible() {
            return (this.elements.toolbar && this.elements.toolbar.classList.contains('visible'));
        }

        toggleCopySelectionIcon(success) {
            const btn = this.elements.buttons.copySelection;
            if (!btn) return;

            const ICONS = window.GeminiToolbarIcons;
            if (success === true) {
                btn.innerHTML = `${ICONS.CHECK}`;
            } else {
                btn.innerHTML = `${ICONS.COPY}`;
            }
        }
    }

    window.GeminiViewWidget = WidgetView;
})();
