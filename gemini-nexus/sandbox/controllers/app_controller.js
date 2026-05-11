
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
        this.generatingSessionId = null;
        this.pageContextActive = false;
        this.browserControlActive = false;
        this.sidePanelScope = 'remembered_tabs';
        this.currentTabId = null;
        this.boundSessionId = null;
        this.sessionsRestored = false;
        
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

        document.addEventListener('gemini-provider-changed', () => {
            if (!this.isGenerating) this.rerender();
        });
    }

    setCaptureMode(mode) {
        this.captureMode = mode;
    }
    
    togglePageContext() {
        this.pageContextActive = !this.pageContextActive;
        this.ui.chat.togglePageContext(this.pageContextActive);
        
        if (this.pageContextActive) {
            this._checkPageContent();
        }
    }

    setPageContext(enable) {
        if (this.pageContextActive !== enable) {
            this.togglePageContext();
        } else if (enable) {
            this._checkPageContent();
        }
    }

    _checkPageContent() {
        this.ui.updateStatus(t('readingPage'));
        sendToBackground({ action: "CHECK_PAGE_CONTEXT" });
    }

    toggleBrowserControl(forceState = null) {
        // If forceState is provided, match it. Otherwise toggle.
        if (forceState !== null) {
            if (this.browserControlActive === forceState) return;
            this.browserControlActive = forceState;
        } else {
            this.browserControlActive = !this.browserControlActive;
        }

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
        const connectionData = this.ui.settings?.connectionData;
        const provider = connectionData?.provider || (connectionData?.useOfficialApi ? 'official' : 'web');
        if (provider === 'openai' && connectionData) {
            connectionData.openaiSelectedModel = model;
        }
        window.parent.postMessage({
            action: 'SAVE_MODEL',
            payload: { provider, model }
        }, '*');
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

    saveCurrentTabSessionBinding(sessionId) {
        if (!Number.isInteger(this.currentTabId) || this.currentTabId <= 0) return;
        window.parent.postMessage({
            action: 'SAVE_SIDE_PANEL_SESSION_BINDING',
            payload: {
                tabId: this.currentTabId,
                sessionId
            }
        }, '*');
    }

    getBoundSession() {
        return this.boundSessionId
            ? this.sessionManager.getSessionById(this.boundSessionId)
            : null;
    }

    restoreRememberedTabSession() {
        const boundSession = this.getBoundSession();
        if (boundSession) {
            if (this.sessionManager.currentSessionId !== boundSession.id) {
                this.switchToSession(boundSession.id);
            }
            return;
        }

        this.sessionFlow.enterDraft();
    }

    getMessageCount(session) {
        return Array.isArray(session?.messages) ? session.messages.length : 0;
    }

    hasNewAiMessage(session, previousMessageCount) {
        const messages = Array.isArray(session?.messages) ? session.messages : [];
        if (messages.length <= previousMessageCount) return false;
        return messages.slice(previousMessageCount).some(message => message?.role === 'ai');
    }

    syncCurrentSessionFromStorage(sessionId, previousMessageCount) {
        const session = this.sessionManager.getSessionById(sessionId);
        if (!this.hasNewAiMessage(session, previousMessageCount)) return false;

        const scrollState = this.ui.getChatScrollState ? this.ui.getChatScrollState() : null;
        this.sessionFlow.switchToSession(sessionId, { restoreScrollState: scrollState });
        this.messageHandler.markSessionRenderedFromStorage(sessionId, this.getMessageCount(session));
        return true;
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
        if (action === 'RESTORE_SIDE_PANEL_SCOPE') {
            this.sidePanelScope = payload || 'remembered_tabs';
            this.ui.settings.updateSidePanelScope(payload);
            return;
        }
        if (action === 'RESTORE_CONTEXT_SETTINGS') {
            this.ui.settings.updateContextSettings(payload);
            return;
        }
        if (action === 'RESTORE_SIDE_PANEL_TAB_CONTEXT') {
            this.currentTabId = payload?.tabId || null;
            this.boundSessionId = payload?.sessionId || null;
            if (this.sessionsRestored && this.sidePanelScope === 'remembered_tabs') {
                this.restoreRememberedTabSession();
            }
            return;
        }

        // Restore Sessions
        if (action === 'RESTORE_SESSIONS') {
            const restoredSessions = Array.isArray(payload) ? payload : [];
            const previousCurrentId = this.sessionManager.currentSessionId;
            const previousCurrentSession = this.sessionManager.getCurrentSession();
            const previousMessageCount = this.getMessageCount(previousCurrentSession);

            this.sessionManager.setSessions(restoredSessions);
            this.sessionsRestored = true;
            this.sessionFlow.refreshHistoryUI();
            if (this.sessionManager.sessions.length !== restoredSessions.length) {
                saveSessionsToStorage(this.sessionManager.getPersistableSessions());
            }

            if (previousCurrentId && previousCurrentSession) {
                this.syncCurrentSessionFromStorage(previousCurrentId, previousMessageCount);
            }

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

                 if (this.sidePanelScope === 'remembered_tabs') {
                     this.restoreRememberedTabSession();
                 } else if (shouldRestore && sorted.length > 0) {
                     this.switchToSession(sorted[0].id);
                 } else {
                     this.handleNewChat();
                 }
            }
            return;
        }

        if (action === 'RESTORE_CONNECTION_SETTINGS') {
            this.ui.settings.updateConnectionSettings(payload);
            // Fix: Pass the full settings payload object, not just the boolean flag
            this.ui.updateModelList(payload);
            return;
        }

        if (action === 'BACKGROUND_MESSAGE') {
            if (payload.action === 'SWITCH_SESSION') {
                this.switchToSession(payload.sessionId);
                return;
            }
            if (payload.action === 'ACTIVATE_BROWSER_CONTROL') {
                this.toggleBrowserControl(true);
                if(this.ui.inputFn) this.ui.inputFn.focus();
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
            // Page Context Check Result
            if (payload.action === 'PAGE_CONTEXT_RESULT') {
                const len = payload.length;
                const formatted = new Intl.NumberFormat().format(len);
                const msg = t('pageReadSuccess').replace('{count}', formatted);
                this.ui.updateStatus(msg);
                setTimeout(() => { if(!this.isGenerating) this.ui.updateStatus(""); }, 3000);
                return;
            }
            
            await this.messageHandler.handle(payload);
        }
        
        // Pass other messages to message bridge handler if not handled here
        // (AppMessageBridge handles standard restores, this controller handles extended logic)
    }
}
