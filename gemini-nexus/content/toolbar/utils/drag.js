
// content/toolbar/utils/drag.js
(function() {
    /**
     * Module: Drag Behavior
     * Handles draggable window logic with Edge Snapping (Docking)
     */
    class DragController {
        constructor(targetEl, handleEl, callbacks = {}) {
            this.target = targetEl;
            this.handle = handleEl;
            this.callbacks = callbacks; // { onSnap(side, top), onUndock() }
            
            this.isDragging = false;
            this.isFixed = false; // Cache position type during drag
            this.dragOffset = { x: 0, y: 0 };

            // Bind methods for event listeners
            this.onDragMove = this.onDragMove.bind(this);
            this.onDragEnd = this.onDragEnd.bind(this);

            this.init();
        }

        init() {
            // Mouse
            this.handle.addEventListener('mousedown', (e) => {
                // Fix: Allow interaction with buttons, selects, and inputs inside the header
                if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
                
                if (window.matchMedia("(max-width: 600px)").matches) return;

                e.preventDefault();
                this.startDrag(e.clientX, e.clientY);
            });

            // Touch
            this.handle.addEventListener('touchstart', (e) => {
                // Fix: Allow interaction with buttons, selects, and inputs inside the header
                if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
                
                if (window.matchMedia("(max-width: 600px)").matches) return;

                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            }, { passive: true });
        }

        startDrag(clientX, clientY) {
            // Signal potential undock
            if (this.callbacks.onUndock) {
                this.callbacks.onUndock();
            }

            this.isDragging = true;
            
            // Detect position strategy (fixed vs absolute)
            // The Ask Window is 'fixed', the Floating Toolbar is 'absolute'
            const style = window.getComputedStyle(this.target);
            this.isFixed = style.position === 'fixed';

            const rect = this.target.getBoundingClientRect();
            
            // Calculate offset within the element
            this.dragOffset.x = clientX - rect.left;
            this.dragOffset.y = clientY - rect.top;

            this.target.classList.add('dragging');
            
            // Calculate initial position coordinates
            let initialLeft = rect.left;
            let initialTop = rect.top;

            // If absolute (not fixed), we must include scroll offsets because 
            // the element's coordinate system is the document, not the viewport.
            if (!this.isFixed) {
                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;
                initialLeft += scrollX;
                initialTop += scrollY;
            }

            // Ensure style is set for initial move (resetting any dock styles or transforms)
            this.target.style.left = `${initialLeft}px`;
            this.target.style.top = `${initialTop}px`;
            this.target.style.transform = 'none';
            this.target.style.right = 'auto'; // Reset right if previously docked right

            // Attach global listeners
            document.addEventListener('mousemove', this.onDragMove);
            document.addEventListener('mouseup', this.onDragEnd);
            document.addEventListener('touchmove', this.onDragMove, { passive: false });
            document.addEventListener('touchend', this.onDragEnd);
        }

        onDragMove(e) {
            if (!this.isDragging) return;
            
            let clientX, clientY;
            
            if (e.type === 'touchmove') {
                 e.preventDefault(); 
                 clientX = e.touches[0].clientX;
                 clientY = e.touches[0].clientY;
            } else {
                 e.preventDefault();
                 clientX = e.clientX;
                 clientY = e.clientY;
            }

            let newLeft = clientX - this.dragOffset.x;
            let newTop = clientY - this.dragOffset.y;

            // Add scroll offset for absolute elements (Floating Toolbar)
            if (!this.isFixed) {
                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;
                newLeft += scrollX;
                newTop += scrollY;
            }

            this.target.style.left = `${newLeft}px`;
            this.target.style.top = `${newTop}px`;
        }

        onDragEnd() {
            this.isDragging = false;
            this.target.classList.remove('dragging');
            
            // Remove global listeners
            document.removeEventListener('mousemove', this.onDragMove);
            document.removeEventListener('mouseup', this.onDragEnd);
            document.removeEventListener('touchmove', this.onDragMove);
            document.removeEventListener('touchend', this.onDragEnd);

            // --- Check for Docking Snap ---
            this._checkDocking();
        }

        _checkDocking() {
            if (!this.callbacks.onSnap) return;

            const rect = this.target.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const threshold = 30; // Snap threshold

            // Check Left Edge
            if (rect.left < threshold) {
                this.callbacks.onSnap('left', rect.top);
            } 
            // Check Right Edge
            else if (rect.right > viewportWidth - threshold) {
                this.callbacks.onSnap('right', rect.top);
            }
        }
        
        reset() {
            this.target.classList.remove('dragging');
            this.target.style.transform = '';
        }
    }

    // Export to Window
    window.GeminiDragController = DragController;
})();
