
// content/overlay.js

class SelectionOverlay {
    constructor() {
        this.overlay = null;
        this.backgroundImg = null;
        this.selectionBox = null;
        this.hint = null;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;

        // Bind methods
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onClick = this.onClick.bind(this);
    }

    start(screenshotBase64 = null) {
        // Cleanup existing
        this.cleanup();
        this.createDOM(screenshotBase64);
        this.attachListeners();
    }

    createDOM(screenshotBase64) {
        this.overlay = document.createElement('div');
        this.overlay.id = 'gemini-nexus-overlay';
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.4); z-index: 2147483647;
            cursor: crosshair; user-select: none;
            overflow: hidden;
        `;

        // Add the screenshot as a frozen background
        if (screenshotBase64) {
            this.backgroundImg = document.createElement('img');
            this.backgroundImg.src = screenshotBase64;
            this.backgroundImg.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                object-fit: cover; pointer-events: none;
                filter: brightness(0.6);
            `;
            this.overlay.appendChild(this.backgroundImg);
        }

        this.selectionBox = document.createElement('div');
        this.selectionBox.style.cssText = `
            position: fixed; border: 2px solid #0b57d0;
            background-color: rgba(11, 87, 208, 0.1);
            display: none; pointer-events: none; z-index: 2147483648;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3); /* Cut-out effect */
        `;
        
        // If we have a background image, we can use it to create a high-contrast cut-out
        if (screenshotBase64) {
             const innerImg = document.createElement('div');
             innerImg.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
                background-image: url(${screenshotBase64});
                background-size: 100vw 100vh;
                background-repeat: no-repeat;
                pointer-events: none;
             `;
             this.selectionBox.appendChild(innerImg);
             this.selectionBox.style.overflow = 'hidden';
             
             // Dynamic position for innerImg to match viewport coordinates
             this.innerImgRef = innerImg;
        }

        this.hint = document.createElement('div');
        
        const isZh = navigator.language.startsWith('zh');
        this.hint.textContent = isZh ? "拖拽框选区域 / 单击任意处取消" : "Drag to capture area / Click anywhere to cancel";
        
        this.hint.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            color: white; background: rgba(0, 0, 0, 0.8);
            padding: 8px 16px; border-radius: 20px; font-size: 14px;
            font-family: sans-serif; pointer-events: none; z-index: 2147483649;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        `;

        this.overlay.appendChild(this.selectionBox);
        this.overlay.appendChild(this.hint);
        (document.documentElement || document.body).appendChild(this.overlay);
    }

    attachListeners() {
        this.overlay.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove, { capture: true });
        window.addEventListener('mouseup', this.onMouseUp, { capture: true });
        window.addEventListener('keydown', this.onKeyDown, { capture: true });
        
        window.addEventListener('click', this.onClick, { capture: true });
        window.addEventListener('contextmenu', this.onClick, { capture: true });
    }

    cleanup() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        window.removeEventListener('mousemove', this.onMouseMove, true);
        window.removeEventListener('mouseup', this.onMouseUp, true);
        window.removeEventListener('keydown', this.onKeyDown, true);
        
        setTimeout(() => {
            window.removeEventListener('click', this.onClick, true);
            window.removeEventListener('contextmenu', this.onClick, true);
        }, 100);

        this.overlay = null;
        this.selectionBox = null;
        this.backgroundImg = null;
        this.innerImgRef = null;
    }

    onMouseDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        this.selectionBox.style.display = 'block';
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        
        if (this.innerImgRef) {
            this.innerImgRef.style.marginLeft = `-${this.startX}px`;
            this.innerImgRef.style.marginTop = `-${this.startY}px`;
        }

        this.hint.style.display = 'none';
    }

    onMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        const left = Math.min(currentX, this.startX);
        const top = Math.min(currentY, this.startY);

        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';

        if (this.innerImgRef) {
            this.innerImgRef.style.marginLeft = `-${left}px`;
            this.innerImgRef.style.marginTop = `-${top}px`;
        }
    }

    onMouseUp(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = false;

        const rect = this.selectionBox.getBoundingClientRect();
        this.cleanup();

        if (rect.width < 5 || rect.height < 5) {
            return;
        }

        setTimeout(() => {
            chrome.runtime.sendMessage({
                action: "AREA_SELECTED",
                area: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                    pixelRatio: window.devicePixelRatio
                }
            });
        }, 50);
    }

    onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.cleanup();
        }
    }
    
    onClick(e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// Attach to window so content.js can access it
window.GeminiNexusOverlay = SelectionOverlay;
