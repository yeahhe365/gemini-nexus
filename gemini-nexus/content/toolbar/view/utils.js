



// content/toolbar/view/utils.js
(function() {
    /**
     * Shared Utility for Positioning Elements
     */
    window.GeminiViewUtils = {
        positionElement: function(el, rect, isLargerWindow, isPinned, mousePoint) {
            // Do not reposition if pinned and already visible
            if (isPinned && el.classList.contains('visible')) return;

            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // 1. Get Dimensions
            let width = el.offsetWidth;
            let height = el.offsetHeight;

            // Fallback for hidden elements (estimate dimensions)
            if (width === 0 || height === 0) {
                width = isLargerWindow ? 400 : 220; 
                height = isLargerWindow ? 300 : 40;
            }

            const padding = 10;
            const offset = 12; // Gap between mouse/selection and toolbar

            // Determine Anchor Point
            // Prioritize Mouse Point for "Bottom Right of Mouse" style
            let anchorX, anchorY;

            if (mousePoint) {
                anchorX = mousePoint.x;
                anchorY = mousePoint.y;
            } else if (rect) {
                // Fallback to rect bottom-right if no mouse point provided
                anchorX = rect.right;
                anchorY = rect.bottom;
            } else {
                anchorX = vw / 2;
                anchorY = vh / 2;
            }

            // --- Calculate Visual Position (Top-Left corner of Element) ---
            
            // Default Preference: Bottom-Right of Cursor
            let visualLeft = anchorX + offset;
            let visualTop = anchorY + offset;

            // --- Horizontal Boundary Logic ---
            // If toolbar extends past right edge
            if (visualLeft + width > vw - padding) {
                // Flip to Left of Cursor
                visualLeft = anchorX - width - offset;

                // If flipping left pushes it off left screen (e.g. huge element or very left cursor)
                if (visualLeft < padding) {
                    visualLeft = vw - width - padding; // Pin to right edge of screen
                }
            }

            // --- Vertical Boundary Logic ---
            // If toolbar extends past bottom edge
            if (visualTop + height > vh - padding) {
                // Flip to Top of Cursor
                visualTop = anchorY - height - offset;
                
                // Update arrow classes for Small Toolbar
                if (!isLargerWindow) {
                    el.classList.remove('placed-bottom');
                    el.classList.add('placed-top');
                }

                // If flipping top pushes it off top screen
                if (visualTop < padding) {
                    visualTop = vh - height - padding; // Pin to bottom edge of screen
                }
            } else {
                // Default: Placed Bottom
                if (!isLargerWindow) {
                    el.classList.remove('placed-top');
                    el.classList.add('placed-bottom');
                }
            }

            // --- Apply Coordinates ---
            
            if (!isLargerWindow) {
                // Small Toolbar: CSS has transform: translateY(10px) (no horizontal transform)
                // So style.left is exact position.
                el.style.left = `${visualLeft + scrollX}px`;
                el.style.top = `${visualTop + scrollY}px`;
            } else {
                // Ask Window: Fixed positioning, no transform centering.
                el.style.left = `${visualLeft}px`;
                el.style.top = `${visualTop}px`;
            }
        },

        resizeSelect: function(select) {
            if (!select) return;
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.position = 'absolute';
            span.style.fontSize = '13px'; // Match CSS
            span.style.fontWeight = '500'; // Match CSS
            span.style.fontFamily = window.getComputedStyle(select).fontFamily;
            span.style.whiteSpace = 'nowrap';
            span.textContent = select.options[select.selectedIndex].text;
            
            if (select.parentNode) {
                select.parentNode.appendChild(span);
                const width = span.getBoundingClientRect().width;
                select.parentNode.removeChild(span);
                
                // Add padding (12px * 2 = 24px) + increased buffer (10px) = 34px
                select.style.width = `${width + 34}px`;
            }
        }
    };
})();