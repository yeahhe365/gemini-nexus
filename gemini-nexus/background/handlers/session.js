
// background/handlers/session.js
import { PromptHandler } from './session/prompt_handler.js';
import { QuickAskHandler } from './session/quick_ask_handler.js';
import { ContextHandler } from './session/context_handler.js';

export class SessionMessageHandler {
    constructor(sessionManager, imageHandler, controlManager, mcpManager) {
        this.sessionManager = sessionManager;
        this.promptHandler = new PromptHandler(sessionManager, controlManager, mcpManager);
        this.quickAskHandler = new QuickAskHandler(sessionManager, imageHandler);
        this.contextHandler = new ContextHandler(sessionManager);
    }

    handle(request, sender, sendResponse) {
        // --- PROMPT EXECUTION ---
        if (request.action === "SEND_PROMPT") {
            return this.promptHandler.handle(request, sendResponse);
        }

        // --- QUICK ASK (CONTENT SCRIPT) ---
        if (request.action === "QUICK_ASK") {
            this.quickAskHandler.handleQuickAsk(request, sender).finally(() => {
                sendResponse({ status: "completed" });
            });
            return true;
        }

        // --- QUICK ASK IMAGE ---
        if (request.action === "QUICK_ASK_IMAGE") {
            this.quickAskHandler.handleQuickAskImage(request, sender).finally(() => {
                sendResponse({ status: "completed" });
            });
            return true;
        }

        // --- CONTROL ---
        if (request.action === "CANCEL_PROMPT") {
            const cancelled = this.sessionManager.cancelCurrentRequest();
            // Ensure the prompt loop logic also stops
            this.promptHandler.cancel();
            sendResponse({ status: cancelled ? "cancelled" : "no_active_request" });
            return false;
        }

        // --- CONTEXT ---
        if (request.action === "SET_CONTEXT") {
            return this.contextHandler.handleSetContext(request, sendResponse);
        }

        if (request.action === "RESET_CONTEXT") {
            return this.contextHandler.handleResetContext(request, sendResponse);
        }

        return false;
    }
}
