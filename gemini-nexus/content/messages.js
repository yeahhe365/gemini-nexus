
// content/messages.js

(function() {
    class MessageRouter {
        constructor() {
            this.toolbarController = null;
            this.selectionOverlay = null;
            // Track capture source
            this.captureSource = null;
        }

        init(toolbarController, selectionOverlay) {
            this.toolbarController = toolbarController;
            this.selectionOverlay = selectionOverlay;
            
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                return this.handle(request, sender, sendResponse);
            });
        }

        handle(request, sender, sendResponse) {
            // Context Menu Actions
            if (request.action === "CONTEXT_MENU_ACTION") {
                if (this.toolbarController) {
                    this.toolbarController.handleContextAction(request.mode);
                }
                sendResponse({status: "ok"});
                return true;
            }

            // Focus Input
            if (request.action === "FOCUS_INPUT") {
                this._focusInput(sendResponse);
                return true;
            }

            // Start Selection Mode (Screenshot received)
            if (request.action === "START_SELECTION") {
                this.captureSource = request.source; 

                // Hide floating UI to prevent self-capture artifacts
                if (this.toolbarController) {
                    this.toolbarController.hideAll();
                    if (request.mode) {
                        this.toolbarController.currentMode = request.mode;
                    }
                }
                
                this.selectionOverlay.start(request.image);
                sendResponse({status: "selection_started"});
                return true;
            }

            // Crop Result (Area selected)
            if (request.action === "CROP_SCREENSHOT") {
                if (this.captureSource === 'sidepanel') {
                    // Forward back to sidepanel via background
                    chrome.runtime.sendMessage({ 
                        action: "PROCESS_CROP_IN_SIDEPANEL", 
                        payload: request 
                    });
                    this.captureSource = null;
                } else {
                    // Handle locally
                    if (this.toolbarController) {
                        this.toolbarController.handleCropResult(request);
                    }
                }
                sendResponse({status: "ok"});
                return true;
            }

            // Generated Image Result
            if (request.action === "GENERATED_IMAGE_RESULT") {
                if (this.toolbarController) {
                    this.toolbarController.handleGeneratedImageResult(request);
                }
                sendResponse({status: "ok"});
                return true;
            }

            // Get Active Selection
            if (request.action === "GET_SELECTION") {
                sendResponse({ selection: window.getSelection().toString() });
                return true;
            }

            // Get Full Page Content
            if (request.action === "GET_PAGE_CONTENT") {
                this._getPageContent(sendResponse);
                return true;
            }
            
            return false;
        }

        _focusInput(sendResponse) {
            try {
                const inputBox = document.querySelector('div[contenteditable="true"][role="textbox"]');
                if (inputBox) {
                    inputBox.focus();
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) selection.removeAllRanges();
                    sendResponse({status: "ok"});
                } else {
                    sendResponse({status: "error", msg: "DOM_NOT_FOUND"});
                }
            } catch (e) {
                sendResponse({status: "error", msg: e.message});
            }
        }

        _getPageContent(sendResponse) {
            try {
                let text = document.body.innerText || "";
                text = text.replace(/\n{3,}/g, '\n\n');
                sendResponse({ content: text });
            } catch(e) {
                sendResponse({ content: "", error: e.message });
            }
        }
    }

    window.GeminiMessageRouter = new MessageRouter();
})();
