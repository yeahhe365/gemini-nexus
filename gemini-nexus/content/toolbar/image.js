
// content/toolbar/image.js

(function() {
    class GeminiImageDetector {
        constructor(callbacks) {
            this.callbacks = callbacks || {}; // { onShow, onHide }
            this.hoveredImage = null;
            this.imageButtonTimeout = null;
            this.isEnabled = false;
            
            // Bind method for event listeners
            this.onImageHover = this.onImageHover.bind(this);
        }

        init() {
            // Default to enabled, but actual state set via setEnabled
            // Event listeners are only active when enabled
        }

        setEnabled(enabled) {
            if (this.isEnabled === enabled) return;
            this.isEnabled = enabled;

            if (enabled) {
                document.addEventListener('mouseover', this.onImageHover, true);
                document.addEventListener('mouseout', this.onImageHover, true);
            } else {
                document.removeEventListener('mouseover', this.onImageHover, true);
                document.removeEventListener('mouseout', this.onImageHover, true);
                this.scheduleHide(0); // Hide immediately
            }
        }

        onImageHover(e) {
            if (!this.isEnabled) return;
            const isEnter = e.type === 'mouseover';

            if (e.target.tagName !== 'IMG') return;

            // Ignore small images (icons, spacers)
            const img = e.target;
            if (img.width < 100 || img.height < 100) return;

            if (isEnter) {
                if (this.imageButtonTimeout) clearTimeout(this.imageButtonTimeout);
                this.hoveredImage = img;
                const rect = img.getBoundingClientRect();
                
                if (this.callbacks.onShow) {
                    this.callbacks.onShow(rect);
                }
            } else {
                this.scheduleHide();
            }
        }

        scheduleHide(delay = 200) {
            if (this.imageButtonTimeout) clearTimeout(this.imageButtonTimeout);
            this.imageButtonTimeout = setTimeout(() => {
                if (this.callbacks.onHide) {
                    this.callbacks.onHide();
                }
                this.hoveredImage = null;
            }, delay); 
        }

        cancelHide() {
            if (this.imageButtonTimeout) clearTimeout(this.imageButtonTimeout);
        }

        getCurrentImage() {
            return this.hoveredImage;
        }
    }

    // Export to Window
    window.GeminiImageDetector = GeminiImageDetector;
})();