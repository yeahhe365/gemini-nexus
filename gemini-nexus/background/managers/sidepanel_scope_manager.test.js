import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidePanelScopeManager, getPanelPathForTab } from './sidepanel_scope_manager.js';

function setupChrome() {
    globalThis.chrome = {
        sidePanel: {
            setOptions: vi.fn(() => Promise.resolve()),
            open: vi.fn(() => Promise.resolve())
        },
        storage: {
            session: {
                set: vi.fn(() => Promise.resolve())
            }
        }
    };
}

describe('SidePanelScopeManager tab-scoped paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupChrome();
    });

    it('builds stable owner-tab side panel paths', () => {
        expect(getPanelPathForTab(123)).toBe('sidepanel/index.html?tabId=123');
        expect(getPanelPathForTab(null)).toBe('sidepanel/index.html');
        expect(getPanelPathForTab(-1)).toBe('sidepanel/index.html');
    });

    it('opens remembered-tab panels with the owner tab id in the path', async () => {
        const manager = new SidePanelScopeManager();

        await manager.openForTab(123, 456);

        expect(chrome.sidePanel.setOptions).toHaveBeenCalledWith({
            tabId: 123,
            path: 'sidepanel/index.html?tabId=123',
            enabled: true
        });
        expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 123, windowId: 456 });
    });
});
