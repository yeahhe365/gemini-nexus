
// content/toolbar/stream.js

(function() {
    class GeminiStreamHandler {
        constructor(uiController, callbacks) {
            this.ui = uiController;
            this.callbacks = callbacks || {}; // { onSessionId }
            this.handleStreamMessage = this.handleStreamMessage.bind(this);
        }

        init() {
            chrome.runtime.onMessage.addListener(this.handleStreamMessage);
        }

        handleStreamMessage(request, sender, sendResponse) {
            if (request.action === "GEMINI_STREAM_UPDATE") {
                if (this.ui.isVisible()) {
                    // Update result in real-time, passing isStreaming = true
                    this.ui.showResult(request.text, null, true);
                }
            }
            
            if (request.action === "GEMINI_STREAM_DONE") {
                const result = request.result;
                
                if (request.sessionId) {
                    if (this.callbacks.onSessionId) {
                        this.callbacks.onSessionId(request.sessionId);
                    }
                }

                if (this.ui.isVisible()) {
                    if (result && result.status === 'success') {
                        // Finished, pass isStreaming = false
                        // Pass result.images array
                        this.ui.showResult(result.text, null, false, result.images);
                    } else if (result && result.status === 'error') {
                        this.ui.showError(result.text);
                    }
                    // If result is null (cancelled), do nothing or handle accordingly
                }
            }
        }
    }

    // Export to Window
    window.GeminiStreamHandler = GeminiStreamHandler;
})();