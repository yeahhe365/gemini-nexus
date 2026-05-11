
// content/toolbar/ui/renderer.js
(function() {
    /**
     * Handles the rendering of results in the toolbar window,
     * including Markdown transformation (via Bridge) and Generated Images grid.
     */
    class UIRenderer {
        constructor(view, bridge) {
            this.view = view;
            this.bridge = bridge;
            this.currentResultText = '';
        }

        /**
         * Renders the text result and optionally processes generated images.
         */
        async show(text, title, isStreaming, images = []) {
            this.currentResultText = text;
            
            // Delegate rendering to iframe (Offscreen Renderer)
            // The bridge now handles both Markdown AND Image HTML generation to share logic with Sandbox
            let html = text;
            let tasks = [];

            if (this.bridge) {
                try {
                    const result = await this.bridge.render(text, isStreaming ? [] : images);
                    html = result.html;
                    tasks = result.fetchTasks || [];
                } catch (e) {
                    console.warn("Bridge render failed, falling back to simple escape");
                    html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                }
            }

            // Pass to view
            this.view.showResult(html, title, isStreaming);
                 
            // Execute fetch tasks (images) if any
            if (tasks.length > 0) {
                this._executeImageFetchTasks(tasks);
            }
        }
        
        _executeImageFetchTasks(tasks) {
            const container = this.view.elements.resultText;
            if(!container) return;

            tasks.forEach(task => {
                const img = container.querySelector(`img[data-req-id="${task.reqId}"]`);
                if(img) {
                    // Send message to background to fetch actual image
                    chrome.runtime.sendMessage({ 
                        action: "FETCH_GENERATED_IMAGE", 
                        url: task.url, 
                        reqId: task.reqId 
                    });
                }
            });
        }
        
        handleGeneratedImageResult(request) {
             const container = this.view.elements.resultText;
             if(!container) return;
             
             const img = container.querySelector(`img[data-req-id="${request.reqId}"]`);
             if (img) {
                 if (request.base64) {
                     img.src = request.base64;
                     img.classList.remove('loading');
                     img.style.minHeight = "auto";
                 } else {
                     img.style.background = "#ffebee";
                     img.alt = "Failed to load";
                 }
             }
        }

        get currentText() {
            return this.currentResultText;
        }
    }

    window.GeminiUIRenderer = UIRenderer;
})();
