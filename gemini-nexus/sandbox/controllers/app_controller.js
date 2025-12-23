
// sandbox/controllers/app_controller.js
import { MessageHandler } from './message_handler.js';
import { SessionFlowController } from './session_flow.js';
import { PromptController } from './prompt.js';
import { t } from '../core/i18n.js';
import { saveSessionsToStorage, sendToBackground } from '../../lib/messaging.js';

export class AppController {
    constructor(sessionManager, uiController, imageManager) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        
        this.captureMode = 'snip'; 
        this.isGenerating = false; 
        this.pageContextActive = false;
        this.browserControlActive = false;
        
        // Sidebar Restore Behavior: 'auto', 'restore', 'new'
        this.sidebarRestoreBehavior = 'auto';

        // Initialize Message Handler
        this.messageHandler = new MessageHandler(
            sessionManager, 
            uiController, 
            imageManager, 
            this
        );

        // Initialize Sub-Controllers
        this.sessionFlow = new SessionFlowController(sessionManager, uiController, this);
        this.prompt = new PromptController(sessionManager, uiController, imageManager, this);
    }

    setCaptureMode(mode) {
        this.captureMode = mode;
    }
    
    togglePageContext() {
        this.pageContextActive = !this.pageContextActive;
        this.ui.chat.togglePageContext(this.pageContextActive);
        
        if (this.pageContextActive) {
            this.ui.updateStatus(t('pageContextEnabled'));
            setTimeout(() => { if(!this.isGenerating) this.ui.updateStatus(""); }, 2000);
        }
    }

    setPageContext(enable) {
        if (this.pageContextActive !== enable) {
            this.togglePageContext();
        } else if (enable) {
            this.ui.updateStatus(t('pageContextActive'));
            setTimeout(() => { if(!this.isGenerating) this.ui.updateStatus(""); }, 2000);
        }
    }

    toggleBrowserControl() {
        this.browserControlActive = !this.browserControlActive;
        const btn = document.getElementById('browser-control-btn');
        if (btn) {
            btn.classList.toggle('active', this.browserControlActive);
        }
        
        // Show/Hide the tab switcher in header
        this.ui.toggleTabSwitcher(this.browserControlActive);
        
        // Signal background to start/stop debugger session immediately
        sendToBackground({ 
            action: "TOGGLE_BROWSER_CONTROL", 
            enabled: this.browserControlActive 
        });
        
        if (this.browserControlActive) {
            // Disable page context if browser control is on (optional preference, 
            // but usually commands don't need full page context context)
            // For now, keeping them independent.
        }
    }
    
    handleTabSwitcher() {
        sendToBackground({ action: "GET_OPEN_TABS" });
    }
    
    handleTabSelected(tabId, shouldSwitch = true) {
        // tabId can be null (to unlock) or an integer
        sendToBackground({ action: "SWITCH_TAB", tabId: tabId, switchVisual: shouldSwitch });
    }

    // --- Delegation to Sub-Controllers ---

    handleNewChat() {
        this.sessionFlow.handleNewChat();
    }

    switchToSession(sessionId) {
        this.sessionFlow.switchToSession(sessionId);
    }
    
    rerender() {
        const currentId = this.sessionManager.currentSessionId;
        if (currentId) {
            this.switchToSession(currentId);
        }
    }
    
    getSelectedModel() {
        return this.ui.modelSelect ? this.ui.modelSelect.value : "gemini-2.5-flash";
    }

    handleModelChange(model) {
        window.parent.postMessage({ action: 'SAVE_MODEL', payload: model }, '*');
    }

    handleDeleteSession(sessionId) {
        this.sessionFlow.handleDeleteSession(sessionId);
    }

    handleCancel() {
        this.prompt.cancel();
    }

    handleSendMessage() {
        this.prompt.send();
    }

    // --- Event Handling ---

    async handleIncomingMessage(event) {
        const { action, payload } = event.data;
        
        if (action === 'RESTORE_SIDEBAR_BEHAVIOR') {
            this.sidebarRestoreBehavior = payload;
            // Update UI settings panel
            this.ui.settings.updateSidebarBehavior(payload);
            return;
        }

        // Restore Sessions
        if (action === 'RESTORE_SESSIONS') {
            this.sessionManager.setSessions(payload || []);
            this.sessionFlow.refreshHistoryUI();

            const currentId = this.sessionManager.currentSessionId;
            const currentSessionExists = this.sessionManager.getCurrentSession();

            // If we are initializing (no current session yet), apply the behavior logic
            if (!currentId || !currentSessionExists) {
                 const sorted = this.sessionManager.getSortedSessions();
                 
                 let shouldRestore = false;
                 
                 if (this.sidebarRestoreBehavior === 'new') {
                     shouldRestore = false;
                 } else if (this.sidebarRestoreBehavior === 'restore') {
                     shouldRestore = true;
                 } else {
                     // 'auto' mode: Restore if last active within 10 minutes
                     if (sorted.length > 0) {
                         const lastActive = sorted[0].timestamp;
                         const now = Date.now();
                         const tenMinutes = 10 * 60 * 1000;
                         if (now - lastActive < tenMinutes) {
                             shouldRestore = true;
                         }
                     }
                 }

                 if (shouldRestore && sorted.length > 0) {
                     this.switchToSession(sorted[0].id);
                 } else {
                     this.handleNewChat();
                 }
            }
            return;
        }

        if (action === 'RESTORE_CONNECTION_SETTINGS') {
            this.ui.settings.updateConnectionSettings(payload);
            this.ui.updateModelList(payload.useOfficialApi);
            return;
        }

        if (action === 'BACKGROUND_MESSAGE') {
            if (payload.action === 'SWITCH_SESSION') {
                this.switchToSession(payload.sessionId);
                return;
            }
            // Tab list response
            if (payload.action === 'OPEN_TABS_RESULT') {
                this.ui.openTabSelector(payload.tabs, (tabId, shouldSwitch) => this.handleTabSelected(tabId, shouldSwitch), payload.lockedTabId);
                return;
            }
            // Tab Locked Notification (Auto-lock update)
            if (payload.action === 'TAB_LOCKED') {
                if (this.ui && this.ui.tabSelector) {
                    this.ui.tabSelector.updateTrigger(payload.tab);
                }
                return;
            }
            
            await this.messageHandler.handle(payload);
        }
        
        // Pass other messages to message bridge handler if not handled here
        // (AppMessageBridge handles standard restores, this controller handles extended logic)
    }
}