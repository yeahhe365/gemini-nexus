
// sandbox/ui/viewer.js

export class ViewerController {
    constructor() {
        this.state = {
            scale: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0
        };

        this.queryElements();
        this.initListeners();
    }

    queryElements() {
        this.viewer = document.getElementById('image-viewer');
        if (!this.viewer) return;
        
        this.container = document.getElementById('viewer-container');
        this.fullImage = document.getElementById('full-image');
        
        // Controls
        this.btnZoomIn = document.getElementById('viewer-zoom-in');
        this.btnZoomOut = document.getElementById('viewer-zoom-out');
        this.btnReset = document.getElementById('viewer-reset');
        this.btnDownload = document.getElementById('viewer-download');
        this.btnClose = document.getElementById('viewer-close');
        this.lblZoom = document.getElementById('viewer-zoom-level');
    }

    initListeners() {
        if (!this.viewer) return;

        // --- Mouse / Wheel Interactions ---
        this.container.addEventListener('mousedown', (e) => this.startPan(e));
        document.addEventListener('mousemove', (e) => this.pan(e));
        document.addEventListener('mouseup', () => this.endPan());
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.container.addEventListener('dblclick', (e) => {
            if (e.target === this.fullImage || e.target === this.container) {
                this.resetTransform();
            }
        });

        // --- Toolbar Buttons ---
        this.btnZoomIn.addEventListener('click', () => this.zoomIn());
        this.btnZoomOut.addEventListener('click', () => this.zoomOut());
        this.btnReset.addEventListener('click', () => this.resetTransform());
        this.btnClose.addEventListener('click', () => this.close());
        this.btnDownload.addEventListener('click', () => this.downloadImage());

        // --- Backdrop Click to Close ---
        this.viewer.addEventListener('click', (e) => {
            if (e.target === this.viewer) this.close();
        });

        // --- Global Events ---
        document.addEventListener('gemini-view-image', (e) => {
            this.open(e.detail);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.viewer.classList.contains('visible')) {
                this.close();
            }
        });
    }

    // --- State Management ---

    open(src) {
        if (this.fullImage) {
            this.fullImage.src = src;
            this.viewer.classList.add('visible');
            this.resetTransform();
        }
    }

    close() {
        if (this.viewer) {
            this.viewer.classList.remove('visible');
            setTimeout(() => {
                if (this.fullImage) this.fullImage.src = '';
                this.resetState();
            }, 300);
        }
    }

    resetState() {
        this.state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };
    }

    resetTransform() {
        this.state.scale = 1;
        this.state.pointX = 0;
        this.state.pointY = 0;
        this.updateTransform();
    }

    updateTransform() {
        if (!this.fullImage) return;
        this.fullImage.style.transform = `translate(${this.state.pointX}px, ${this.state.pointY}px) scale(${this.state.scale})`;
        this.lblZoom.textContent = `${Math.round(this.state.scale * 100)}%`;
    }

    // --- Actions ---

    handleWheel(e) {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY);
        const step = 0.1;
        const newScale = this.state.scale + (delta * step);
        this.setScale(newScale);
    }

    zoomIn() {
        this.setScale(this.state.scale + 0.25);
    }

    zoomOut() {
        this.setScale(this.state.scale - 0.25);
    }

    setScale(scale) {
        // Clamp scale
        const min = 0.1;
        const max = 5;
        this.state.scale = Math.min(Math.max(scale, min), max);
        this.updateTransform();
    }

    startPan(e) {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        this.state.panning = true;
        this.state.startX = e.clientX - this.state.pointX;
        this.state.startY = e.clientY - this.state.pointY;
        this.container.style.cursor = 'grabbing';
    }

    pan(e) {
        if (!this.state.panning) return;
        e.preventDefault();
        this.state.pointX = e.clientX - this.state.startX;
        this.state.pointY = e.clientY - this.state.startY;
        this.updateTransform();
    }

    endPan() {
        this.state.panning = false;
        this.container.style.cursor = 'grab';
    }

    downloadImage() {
        const src = this.fullImage.src;
        if (!src) return;

        // Delegate to parent (Sidepanel) to bypass Sandbox restrictions
        window.parent.postMessage({
            action: 'DOWNLOAD_IMAGE',
            payload: {
                url: src,
                filename: `gemini-image-${Date.now()}.png`
            }
        }, '*');
    }
}