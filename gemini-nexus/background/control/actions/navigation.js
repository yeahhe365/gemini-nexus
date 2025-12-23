
// background/control/actions/navigation.js
import { BaseActionHandler } from './base.js';

export class NavigationActions extends BaseActionHandler {
    async navigatePage({ url, type }) {
        // Use currentTabId (attached) or fallback to targetTabId (intent)
        const tabId = this.connection.currentTabId || this.connection.targetTabId;
        if (!tabId) return "Error: No target tab identified.";

        let action = "";
        
        await this.waitHelper.execute(async () => {
            if (type === 'back') {
                await chrome.tabs.goBack(tabId);
                action = "Navigated back";
            } else if (type === 'forward') {
                await chrome.tabs.goForward(tabId);
                action = "Navigated forward";
            } else if (type === 'reload') {
                await chrome.tabs.reload(tabId);
                action = "Reloaded page";
            } else if (url) {
                await chrome.tabs.update(tabId, { url });
                action = `Navigating to ${url}`;
            }
        });

        return action || "Error: Invalid navigation arguments.";
    }

    async newPage({ url }) {
        const targetUrl = url || 'about:blank';
        const tab = await chrome.tabs.create({ url: targetUrl });
        
        // Return object with metadata so ControlManager can update the locked tab
        return {
            output: `Created new page (id: ${tab.id}) loading ${targetUrl}`,
            _meta: { switchTabId: tab.id }
        };
    }

    async closePage({ index }) {
        if (index === undefined) return "Error: 'index' is required.";
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs[index];
        if (!tab) return `Error: Page index ${index} not found.`;
        
        await chrome.tabs.remove(tab.id);
        return `Closed page ${index}: ${tab.title || 'Untitled'}`;
    }

    async listPages() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.map((t, idx) => `${idx}: ${t.title} (${t.url})`).join("\n");
    }

    async selectPage({ index }) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs[index];
        if (!tab) return `Error: Index ${index} not found.`;
        
        await chrome.tabs.update(tab.id, { active: true });
        
        // Return object with metadata so ControlManager can update the locked tab
        return {
            output: `Switched to page ${index}: ${tab.title}`,
            _meta: { switchTabId: tab.id }
        };
    }
}
