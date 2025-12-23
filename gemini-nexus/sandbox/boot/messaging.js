
// sandbox/boot/messaging.js

export class AppMessageBridge {
    constructor() {
        this.app = null;
        this.ui = null;
        this.resizeFn = null;
        this.queue = [];
        
        // Bind immediately
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    setApp(appInstance) {
        this.app = appInstance;
        this.flush();
    }

    setUI(uiInstance) {
        this.ui = uiInstance;
        this.flush();
    }

    setResizeFn(fn) {
        this.resizeFn = fn;
    }

    handleMessage(event) {
        const { action, payload } = event.data;
        
        if (this.app && this.ui) {
            this.dispatch(action, payload, event);
        } else {
            // Queue messages until app is ready
            this.queue.push({ action, payload, event });
        }
    }

    flush() {
        if (this.app && this.ui) {
            while (this.queue.length > 0) {
                const { action, payload, event } = this.queue.shift();
                this.dispatch(action, payload, event);
            }
        }
    }

    dispatch(action, payload, event) {
        if (action === 'RESTORE_SHORTCUTS') {
            this.ui.updateShortcuts(payload);
            return;
        }
        if (action === 'RESTORE_THEME') {
            this.ui.updateTheme(payload);
            return;
        }
        if (action === 'RESTORE_LANGUAGE') {
            this.ui.updateLanguage(payload);
            return;
        }
        if (action === 'RESTORE_MODEL') {
            if (this.ui.modelSelect) {
                const prev = this.ui.modelSelect.value;
                this.ui.modelSelect.value = payload;
                // Safety check: if invalid model, fallback
                if (this.ui.modelSelect.selectedIndex === -1) {
                    this.ui.modelSelect.value = prev || (this.ui.modelSelect.options.length > 0 ? this.ui.modelSelect.options[0].value : "");
                    // Force index 0 if still invalid
                    if (this.ui.modelSelect.selectedIndex === -1 && this.ui.modelSelect.options.length > 0) {
                        this.ui.modelSelect.selectedIndex = 0;
                    }
                }
                if (this.resizeFn) this.resizeFn();
            }
            return;
        }
        if (action === 'RESTORE_TEXT_SELECTION') {
            this.ui.settings.updateTextSelection(payload);
            return;
        }
        if (action === 'RESTORE_IMAGE_TOOLS') {
            this.ui.settings.updateImageTools(payload);
            return;
        }
        if (action === 'RESTORE_ACCOUNT_INDICES') {
            this.ui.settings.updateAccountIndices(payload);
            return;
        }
        
        // Note: RESTORE_CONNECTION_SETTINGS is handled by AppController to update Model List
        
        if (action === 'RESTORE_BROWSER_LOOP_LIMIT') {
            // Pass to app controller to store state
            this.app.handleIncomingMessage(event);
            return;
        }

        // Forward general messages to App Controller
        this.app.handleIncomingMessage(event);
    }
}
