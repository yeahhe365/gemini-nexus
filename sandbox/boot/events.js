import { bindInputEvents } from './input_events.js';
import { bindToolButtonEvents } from './tool_button_events.js';

export { getToolsPageScrollDistance } from './tool_button_events.js';

export function bindAppEvents(app, ui, setResizeRef) {
    const newChatHeaderBtn = document.getElementById('new-chat-header-btn');
    if (newChatHeaderBtn) {
        newChatHeaderBtn.addEventListener('click', () => app.handleNewChat());
    }

    ['new-chat-sidebar-btn', 'collapsed-new-chat-btn'].forEach((buttonId) => {
        const newChatSidebarBtn = document.getElementById(buttonId);
        if (newChatSidebarBtn) {
            newChatSidebarBtn.addEventListener('click', () => app.handleNewChat());
        }
    });

    const newGroupSidebarBtn = document.getElementById('new-group-sidebar-btn');
    if (newGroupSidebarBtn) {
        newGroupSidebarBtn.addEventListener('click', () => app.sessionFlow.handleAddNewGroup());
    }

    const tabSwitcherBtn = document.getElementById('tab-switcher-btn');
    if (tabSwitcherBtn) {
        tabSwitcherBtn.addEventListener('click', () => app.handleTabSwitcher());
    }

    const webThinkingToggle = document.getElementById('web-thinking-toggle');
    if (webThinkingToggle) {
        webThinkingToggle.addEventListener('click', () => app.handleWebThinkingToggle());
    }

    const openFullPageBtn = document.getElementById('open-full-page-btn');
    if (openFullPageBtn) {
        openFullPageBtn.addEventListener('click', () => {
            window.parent.postMessage({ action: 'OPEN_FULL_PAGE' }, '*');
        });
    }

    ['settings-btn', 'collapsed-settings-btn'].forEach((buttonId) => {
        const settingsBtn = document.getElementById(buttonId);
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.parent.postMessage({ action: 'OPEN_SETTINGS_PAGE' }, '*');
            });
        }
    });

    bindToolButtonEvents(app, ui);
    bindInputEvents(app, ui, setResizeRef);
}
