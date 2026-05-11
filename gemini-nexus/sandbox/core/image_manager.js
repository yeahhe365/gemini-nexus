
// sandbox/core/image_manager.js

export class ImageManager {
    constructor(elements, callbacks = {}) {
        this.imageInput = elements.imageInput;
        this.imagePreview = elements.imagePreview;
        // previewThumb and removeImgBtn are removed/deprecated in multi-file UI
        this.inputWrapper = elements.inputWrapper;
        this.inputFn = elements.inputFn;
        
        this.onUrlDrop = callbacks.onUrlDrop;
        
        this.files = []; // Array of { base64, type, name }

        this.initListeners();
    }

    initListeners() {
        // File selection
        this.imageInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                Array.from(files).forEach(file => this.handleFile(file));
                // Reset input so same file can be selected again
                this.imageInput.value = '';
            }
        });

        // Paste Support
        document.addEventListener('paste', (e) => {
            const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
            const items = clipboardData.items;
            const html = clipboardData.getData('text/html');
            const text = clipboardData.getData('text/plain');

            let handledFiles = false;
            let handledHtmlImages = false;

            // 1. Check for Files (e.g. Screenshots, File Copy, Word Images)
            for (const item of items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        this.handleFile(file);
                        handledFiles = true;
                    }
                }
            }

            // 2. Check for HTML Images (e.g. Webpage Copy)
            // Only if no files were found directly (to avoid duplicates for apps that provide both)
            if (!handledFiles && html) {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const images = doc.querySelectorAll('img');
                
                images.forEach(img => {
                    const src = img.src;
                    if (!src) return;

                    if (src.startsWith('data:')) {
                        // Direct Base64
                        const match = src.match(/^data:(.+);base64,(.+)$/);
                        if (match) {
                            this.addFile(src, match[1], 'pasted_image.png');
                            handledHtmlImages = true;
                        }
                    } else if (src.startsWith('http')) {
                        // Remote URL
                        if (this.onUrlDrop) {
                            this.onUrlDrop(src);
                            handledHtmlImages = true;
                        }
                    }
                });
            }

            // 3. If we intercepted images, we must manually handle the text insertion
            // to prevent the default paste (which might insert double text or lose the text if we preventDefault globally)
            if (handledFiles || handledHtmlImages) {
                e.preventDefault();
                if (text) {
                    this._insertTextAtCursor(text);
                }
            }
        });

        // Drag and Drop
        const dropZone = document.body;
        let dragCounter = 0;

        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault(); e.stopPropagation();
            dragCounter++;
            this.inputWrapper.classList.add('dragging');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault(); e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                this.inputWrapper.classList.remove('dragging');
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation(); 
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            dragCounter = 0;
            this.inputWrapper.classList.remove('dragging');

            const dt = e.dataTransfer;
            const files = dt.files;
            const html = dt.getData('text/html');
            const text = dt.getData('text/plain');

            let handledFiles = false;
            let handledHtmlImages = false;

            // 1. Files (System Drag)
            if (files && files.length > 0) {
                Array.from(files).forEach(file => this.handleFile(file));
                handledFiles = true;
            }

            // 2. Web Content (Images in HTML)
            if (!handledFiles && html) {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const images = doc.querySelectorAll('img');
                
                images.forEach(img => {
                    const src = img.src;
                    if (!src) return;

                    // Filter out likely spacers or tracking pixels
                    if (img.width > 0 && img.width < 50 && img.height > 0 && img.height < 50) return;

                    if (src.startsWith('data:')) {
                        const match = src.match(/^data:(.+);base64,(.+)$/);
                        if (match) {
                            this.addFile(src, match[1], 'dragged_image.png');
                            handledHtmlImages = true;
                        }
                    } else if (src.startsWith('http')) {
                        if (this.onUrlDrop) {
                            this.onUrlDrop(src);
                            handledHtmlImages = true;
                        }
                    }
                });
            }

            // 3. Text Insertion (Mixed Content)
            if (text) {
                // If we handled images, avoid inserting text if it looks like the URL of the image we just added
                // (Browsers often provide the image URL as text/plain when dragging an image)
                let skipText = false;
                if (handledHtmlImages || handledFiles) {
                    if (text.match(/^https?:\/\//) || text.startsWith('data:')) {
                        skipText = true; 
                    }
                }
                
                if (!skipText) {
                    this._insertTextAtCursor(text);
                }
            }
        });
    }

    _insertTextAtCursor(text) {
        const input = this.inputFn;
        if (!input) return;

        if (input.selectionStart || input.selectionStart === 0) {
            const startPos = input.selectionStart;
            const endPos = input.selectionEnd;
            input.value = input.value.substring(0, startPos)
                + text
                + input.value.substring(endPos, input.value.length);
            
            input.selectionStart = startPos + text.length;
            input.selectionEnd = startPos + text.length;
        } else {
            input.value += text;
        }
        // Trigger resize/input event
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    }

    handleFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.addFile(event.target.result, file.type, file.name);
        };
        reader.readAsDataURL(file);
    }

    // Used by background response handler or direct file input
    setFile(base64, type, name) {
        this.addFile(base64, type, name);
    }

    addFile(base64, type, name) {
        this.files.push({ base64, type, name });
        this._render();
        this.inputFn.focus();
    }
    
    removeFile(index) {
        this.files.splice(index, 1);
        this._render();
    }

    clearFile() {
        this.files = [];
        this._render();
    }

    getFiles() {
        return [...this.files];
    }
    
    _render() {
        this.imagePreview.innerHTML = '';
        
        if (this.files.length === 0) {
            this.imagePreview.classList.remove('has-image');
            return;
        }
        
        this.imagePreview.classList.add('has-image');
        
        this.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            
            // Remove Button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-remove-btn';
            removeBtn.innerHTML = '✕';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeFile(index);
            };
            item.appendChild(removeBtn);
            
            // Content
            if (file.type && file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = file.base64;
                item.appendChild(img);
            } else {
                const card = document.createElement('div');
                card.className = 'file-item-card';
                card.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    <span>${file.name}</span>
                `;
                item.appendChild(card);
            }
            
            this.imagePreview.appendChild(item);
        });
    }
}