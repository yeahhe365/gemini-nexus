// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StateManager, getOwnerTabIdFromLocation } from './state.js';

function createFrame() {
    return {
        getWindow: vi.fn(() => ({})),
        postMessage: vi.fn(),
        reveal: vi.fn()
    };
}

function setupChrome(activeTabId = 33) {
    const listeners = {};

    globalThis.chrome = {
        storage: {
            local: {
                get: vi.fn((keys, callback) => callback({}))
            },
            session: {
                get: vi.fn((keys, callback) => callback({ geminiSidePanelSessionBindings: {} })),
                set: vi.fn()
            },
            onChanged: {
                addListener: vi.fn((listener) => {
                    listeners.storageChanged = listener;
                })
            }
        },
        tabs: {
            query: vi.fn((query, callback) => callback([{ id: activeTabId }])),
            onActivated: {
                addListener: vi.fn((listener) => {
                    listeners.activated = listener;
                })
            },
            onRemoved: {
                addListener: vi.fn((listener) => {
                    listeners.removed = listener;
                })
            }
        },
        runtime: {
            getManifest: vi.fn(() => ({ version: 'test' }))
        }
    };

    return listeners;
}

function setupChromeWithLocalData(localData, activeTabId = 33) {
    const listeners = setupChrome(activeTabId);
    chrome.storage.local.get.mockImplementation((keys, callback) => callback(localData));
    return listeners;
}

describe('StateManager tab ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/sidepanel/index.html');
    });

    it('parses a positive owner tab id from the side panel URL', () => {
        expect(getOwnerTabIdFromLocation({ href: 'chrome-extension://id/sidepanel/index.html?tabId=123' })).toBe(123);
        expect(getOwnerTabIdFromLocation({ href: 'chrome-extension://id/sidepanel/index.html?tabId=0' })).toBeNull();
        expect(getOwnerTabIdFromLocation({ href: 'not a url' })).toBeNull();
    });

    it('keeps a tab-scoped side panel bound to its owner tab when active tab changes', () => {
        window.history.replaceState(null, '', '/sidepanel/index.html?tabId=11');
        const listeners = setupChrome(22);
        const manager = new StateManager(createFrame());

        manager.init();
        listeners.activated({ tabId: 22 });

        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(manager.getCurrentTabId()).toBe(11);
    });

    it('uses active tab tracking only for unscoped side panel pages', () => {
        const listeners = setupChrome(33);
        const manager = new StateManager(createFrame());

        manager.init();
        listeners.activated({ tabId: 44 });

        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
        expect(manager.getCurrentTabId()).toBe(44);
    });

    it('restores the OpenAI-specific selected model when the OpenAI provider is active', () => {
        setupChromeWithLocalData({
            geminiProvider: 'openai',
            geminiModel: 'gemini-3-flash',
            geminiOpenaiModel: 'gpt-4.1, gpt-5',
            geminiOpenaiSelectedModel: 'gpt-5'
        });
        const frame = createFrame();
        const manager = new StateManager(frame);

        manager.init();
        manager.markUiReady();

        expect(frame.postMessage).toHaveBeenCalledWith({
            action: 'RESTORE_CONNECTION_SETTINGS',
            payload: expect.objectContaining({
                provider: 'openai',
                openaiModel: 'gpt-4.1, gpt-5',
                openaiSelectedModel: 'gpt-5',
                selectedModel: 'gpt-5'
            })
        });
        expect(frame.postMessage).toHaveBeenCalledWith({
            action: 'RESTORE_MODEL',
            payload: 'gpt-5'
        });
    });
});
