
// sidepanel/core/bridge.js
import { downloadFile, downloadText } from '../utils/download.js';

export class MessageBridge {
    constructor(frameManager, stateManager) {
        this.frame = frameManager;
        this.state = stateManager;
    }

    init() {
        window.addEventListener('message', this.handleWindowMessage.bind(this));
        chrome.runtime.onMessage.addListener(this.handleRuntimeMessage.bind(this));
    }

    handleWindowMessage(event) {
        // Security check: Only accept messages from our direct iframe
        if (!this.frame.isWindow(event.source)) return;

        const { action, payload } = event.data;

        // 1. Handshake
        if (action === 'UI_READY') {
            this.state.markUiReady();
            return;
        }

        // 2. Window Management
        if (action === 'OPEN_FULL_PAGE') {
            const url = chrome.runtime.getURL('sidepanel/index.html');
            chrome.tabs.create({ url });
            return;
        }

        // 3. Background Forwarding
        if (action === 'FORWARD_TO_BACKGROUND') {
            chrome.runtime.sendMessage(payload)
                .then(response => {
                    // If request demands a reply (e.g., GET_LOGS), send it back
                    if (payload.action === 'GET_LOGS' && response) {
                        this.frame.postMessage({
                            action: 'BACKGROUND_MESSAGE',
                            payload: response
                        });
                    }
                })
                .catch(err => console.warn("Error forwarding to background:", err));
            return;
        }

        // 4. Downloads
        if (action === 'DOWNLOAD_IMAGE') {
            downloadFile(payload.url, payload.filename);
            return;
        }
        if (action === 'DOWNLOAD_LOGS') {
            downloadText(payload.text, payload.filename || 'gemini-nexus-logs.txt');
            return;
        }

        // 5. Data Getters (Immediate Response)
        if (action === 'GET_THEME') {
            this.frame.postMessage({ action: 'RESTORE_THEME', payload: this.state.getCached('geminiTheme') });
            return;
        }
        if (action === 'GET_LANGUAGE') {
            this.frame.postMessage({ action: 'RESTORE_LANGUAGE', payload: this.state.getCached('geminiLanguage') });
            return;
        }
        if (action === 'GET_TEXT_SELECTION') {
            // Some keys might not be in initial bulk fetch if added later, but usually are.
            // Fallback to async storage if needed, but state.data usually has it.
            chrome.storage.local.get(['geminiTextSelectionEnabled'], (res) => {
                const val = res.geminiTextSelectionEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_TEXT_SELECTION', payload: val });
            });
            return;
        }
        if (action === 'GET_IMAGE_TOOLS') {
            chrome.storage.local.get(['geminiImageToolsEnabled'], (res) => {
                const val = res.geminiImageToolsEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_IMAGE_TOOLS', payload: val });
            });
            return;
        }
        if (action === 'GET_ACCOUNT_INDICES') {
            chrome.storage.local.get(['geminiAccountIndices'], (res) => {
                this.frame.postMessage({ action: 'RESTORE_ACCOUNT_INDICES', payload: res.geminiAccountIndices || "0" });
            });
            return;
        }
        if (action === 'GET_CONNECTION_SETTINGS') {
            chrome.storage.local.get(['geminiUseOfficialApi', 'geminiApiKey', 'geminiThinkingLevel'], (res) => {
                this.frame.postMessage({ 
                    action: 'RESTORE_CONNECTION_SETTINGS', 
                    payload: { 
                        useOfficialApi: res.geminiUseOfficialApi === true, 
                        apiKey: res.geminiApiKey || "",
                        thinkingLevel: res.geminiThinkingLevel || "low"
                    } 
                });
            });
            return;
        }

        // 6. Data Setters (Sync to Storage & Cache)
        if (action === 'SAVE_SESSIONS') this.state.save('geminiSessions', payload);
        if (action === 'SAVE_SHORTCUTS') this.state.save('geminiShortcuts', payload);
        if (action === 'SAVE_MODEL') this.state.save('geminiModel', payload);
        if (action === 'SAVE_THEME') this.state.save('geminiTheme', payload);
        if (action === 'SAVE_LANGUAGE') this.state.save('geminiLanguage', payload);
        if (action === 'SAVE_TEXT_SELECTION') this.state.save('geminiTextSelectionEnabled', payload);
        if (action === 'SAVE_IMAGE_TOOLS') this.state.save('geminiImageToolsEnabled', payload);
        if (action === 'SAVE_SIDEBAR_BEHAVIOR') this.state.save('geminiSidebarBehavior', payload);
        if (action === 'SAVE_ACCOUNT_INDICES') this.state.save('geminiAccountIndices', payload);
        if (action === 'SAVE_CONNECTION_SETTINGS') {
            this.state.save('geminiUseOfficialApi', payload.useOfficialApi);
            this.state.save('geminiApiKey', payload.apiKey);
            this.state.save('geminiThinkingLevel', payload.thinkingLevel);
        }
    }

    handleRuntimeMessage(message) {
        if (message.action === 'SESSIONS_UPDATED') {
            this.state.updateSessions(message.sessions);
            this.frame.postMessage({
                action: 'RESTORE_SESSIONS',
                payload: message.sessions
            });
            return;
        }

        // Forward all other background messages to sandbox (e.g. GEMINI_STREAM_UPDATE)
        this.frame.postMessage({
            action: 'BACKGROUND_MESSAGE',
            payload: message
        });
    }
}
