
// content/toolbar/controller.js

(function() {
    class ToolbarController {
        constructor() {
            // Dependencies
            this.ui = new window.GeminiToolbarUI();
            this.actions = new window.GeminiToolbarActions(this.ui);
            
            // Sub-Modules
            this.imageDetector = new window.GeminiImageDetector({
                onShow: (rect) => this.ui.showImageButton(rect),
                onHide: () => this.ui.hideImageButton()
            });

            this.streamHandler = new window.GeminiStreamHandler(this.ui, {
                onSessionId: (id) => { this.lastSessionId = id; }
            });

            this.inputManager = new window.GeminiInputManager();
            
            // Initialize Dispatcher with reference to this controller
            this.dispatcher = new window.GeminiToolbarDispatcher(this);

            // Selection Observer
            this.selectionObserver = new window.GeminiSelectionObserver({
                onSelection: this.handleSelection.bind(this),
                onClear: this.handleSelectionClear.bind(this),
                onClick: this.handleClick.bind(this)
            });

            // State
            this.visible = false;
            this.currentSelection = "";
            this.lastRect = null;
            this.lastMousePoint = null;
            this.lastSessionId = null;
            this.currentMode = 'ask'; // 默认模式
            this.isSelectionEnabled = true;

            // Bind Action Handler
            this.handleAction = this.handleAction.bind(this);
            
            this.init();
        }

        init() {
            // Initialize UI
            this.ui.build();
            this.ui.setCallbacks({
                onAction: this.handleAction,
                onModelChange: (model) => this.handleModelChange(model),
                onImageBtnHover: (isHovering) => {
                    if (isHovering) {
                        this.imageDetector.cancelHide();
                    } else {
                        this.imageDetector.scheduleHide();
                    }
                }
            });

            // Sync Settings (Model & Provider) with Global State
            this.syncSettings();
            
            // Listen for global setting changes to keep toolbar in sync
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local') {
                    const keys = ['geminiModel', 'geminiProvider', 'geminiUseOfficialApi', 'geminiOfficialModel', 'geminiOpenaiModel', 'geminiOpenaiSelectedModel'];
                    if (keys.some(k => changes[k])) {
                        this.syncSettings();
                    }
                }
            });

            // Initialize Modules
            this.imageDetector.init();
            this.streamHandler.init();
        }
        
        async syncSettings() {
            const result = await chrome.storage.local.get([
                'geminiModel', 
                'geminiProvider', 
                'geminiUseOfficialApi', 
                'geminiOfficialModel',
                'geminiOpenaiModel',
                'geminiOpenaiSelectedModel'
            ]);
            
            const settings = {
                provider: result.geminiProvider,
                useOfficialApi: result.geminiUseOfficialApi,
                officialModel: result.geminiOfficialModel,
                openaiModel: result.geminiOpenaiModel
            };
            
            // Update UI options and selection
            const provider = settings.provider || (settings.useOfficialApi ? 'official' : 'web');
            const selectedModel = provider === 'openai'
                ? (result.geminiOpenaiSelectedModel || result.geminiModel)
                : result.geminiModel;
            this.ui.updateModelList(settings, selectedModel);
        }
        
        setSelectionEnabled(enabled) {
            this.isSelectionEnabled = enabled;
            if (!enabled) {
                this.handleSelectionClear();
            }
        }

        setImageToolsEnabled(enabled) {
            this.imageDetector.setEnabled(enabled);
        }

        /**
         * 处理来自右键菜单的动作指令
         */
        handleContextAction(mode) {
            this.currentMode = mode;

            if (mode === 'ask') {
                this.showGlobalInput(false);
            } else if (mode === 'page_chat') {
                this.showGlobalInput(true); // 带网页上下文打开
            } else {
                // 需要截图的操作模式：ocr, snip, screenshot_translate
                chrome.runtime.sendMessage({ action: "INITIATE_CAPTURE" });
            }
        }

        /**
         * 处理截图完成后的结果
         */
        async handleCropResult(request) {
            // 截图已经由 background 完成并发送到了这里
            const isZh = navigator.language.startsWith('zh');
            const rect = {
                left: window.innerWidth / 2 - 200,
                top: 100,
                right: window.innerWidth / 2 + 200,
                bottom: 200,
                width: 400,
                height: 100
            };

            const model = this.ui.getSelectedModel();

            // Client-side Cropping
            let finalImage = request.image;
            if (window.GeminiImageCropper && request.area) {
                try {
                    finalImage = await window.GeminiImageCropper.crop(request.image, request.area);
                } catch(e) {
                    console.error("Crop failed in content script", e);
                }
            }

            if (this.currentMode === 'ocr') {
                this.actions.handleImagePrompt(finalImage, rect, 'ocr', model);
            } else if (this.currentMode === 'screenshot_translate') {
                this.actions.handleImagePrompt(finalImage, rect, 'translate', model);
            } else if (this.currentMode === 'snip') {
                this.actions.handleImagePrompt(finalImage, rect, 'snip', model);
            }
            
            this.currentMode = 'ask'; // 重置模式
            this.visible = true; // Ensure logic knows window is visible
        }

        handleGeneratedImageResult(request) {
            if (request.base64 && this.ui) {
                 // Delegate to the bridge in UI Manager to process image (remove watermark)
                 // This reuses the logic loaded in the sandbox iframe
                 this.ui.processImage(request.base64).then(cleaned => {
                     // Pass cleaned image to UI
                     this.ui.handleGeneratedImageResult({ ...request, base64: cleaned });
                 }).catch(e => {
                     // Fallback to original on error
                     this.ui.handleGeneratedImageResult(request);
                 });
                 return;
            }
            this.ui.handleGeneratedImageResult(request);
        }

        // --- Event Handlers (Delegated from SelectionObserver) ---

        handleClick(e) {
            // If clicking inside our toolbar/window, do nothing
            if (this.ui.isHost(e.target)) return;
            
            // If pinned OR docked, do not hide the window on outside click
            if (this.ui.isPinned || this.ui.isDocked) {
                // Only hide the small selection toolbar if clicking outside
                if (this.visible && !this.ui.isWindowVisible()) {
                    this.hide();
                }
                return;
            }

            this.hide();
        }

        handleSelection(data) {
            if (!this.isSelectionEnabled) return;
            
            const { text, rect, mousePoint } = data;
            this.currentSelection = text;
            this.lastRect = rect;
            this.lastMousePoint = mousePoint;

            // Capture source input element for potential grammar fix
            this.inputManager.capture();

            // Show/hide grammar button based on whether selection is in editable element
            this.ui.showGrammarButton(this.inputManager.hasSource());

            // Show Toolbar
            this.show(rect, mousePoint);
        }

        handleSelectionClear() {
            // Only hide if we aren't currently interacting with the Ask Window
            if (!this.ui.isWindowVisible()) {
                this.currentSelection = "";
                this.inputManager.reset();
                this.hide();
            }
        }

        // --- Action Dispatcher ---

        handleModelChange(model) {
            const provider = this.ui.getProvider ? this.ui.getProvider() : 'web';
            if (provider === 'openai') {
                chrome.storage.local.set({ 'geminiOpenaiSelectedModel': model });
                return;
            }

            chrome.storage.local.set({ 'geminiModel': model });
        }

        handleAction(actionType, data) {
            this.dispatcher.dispatch(actionType, data);
        }

        // --- Helper Methods ---

        show(rect, mousePoint) {
            this.lastRect = rect;
            this.ui.show(rect, mousePoint);
            this.visible = true;
        }

        hide() {
            if (this.ui.isWindowVisible()) return;
            if (!this.visible) return;
            this.ui.hide();
            this.visible = false;
        }

        hideAll() {
            this.ui.hideAll();
            this.visible = false;
        }

        showGlobalInput(withPageContext = false) {
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const width = 400;
            const height = 100;

            const left = (viewportW - width) / 2;
            const top = (viewportH / 2) - 200;

            const rect = {
                left: left, top: top, right: left + width, bottom: top + height,
                width: width, height: height
            };

            this.ui.hide(); 
            const isZh = navigator.language.startsWith('zh');
            
            // 如果带网页上下文，修改标题
            let title = isZh ? "询问" : "Ask Gemini";
            if (withPageContext) {
                title = isZh ? "与当前网页对话" : "Chat with Page";
            }

            this.ui.showAskWindow(rect, null, title);

            this.ui.setInputValue("");
            this.currentSelection = ""; 
            this.lastSessionId = null; 
            this.visible = true;

            // 如果指定了网页上下文模式，在后续发送时包含上下文
            if (withPageContext) {
                this.currentSelection = "__PAGE_CONTEXT_FORCE__";
            }
        }
    }

    // Export to Window
    window.GeminiToolbarController = ToolbarController;
})();
