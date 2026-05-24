// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StandaloneSettingsBridge } from './bridge.js';
import { downloadText } from '../sidepanel/core/downloads.js';

vi.mock('../sidepanel/core/downloads.js', () => ({
    downloadText: vi.fn(),
}));

function createController() {
    return {
        defaultShortcuts: {
            quickAsk: 'Ctrl+G',
            openPanel: 'Alt+S',
            browserControl: 'Ctrl+B',
            ocrCapture: 'Alt+O',
        },
        updateShortcuts: vi.fn(),
        updateTheme: vi.fn(),
        updateLanguage: vi.fn(),
        updateTextSelection: vi.fn(),
        updateTextSelectionBlacklist: vi.fn(),
        updateCustomSelectionTools: vi.fn(),
        updateImageTools: vi.fn(),
        updateSidebarBehavior: vi.fn(),
        updateSidePanelScope: vi.fn(),
        updateAccountIndices: vi.fn(),
        updateContextSettings: vi.fn(),
        updateConnectionSettings: vi.fn(),
        updateAppVersion: vi.fn(),
        updateMcpTestResult: vi.fn(),
        updateMcpToolsResult: vi.fn(),
        saveLogFile: vi.fn(),
    };
}

describe('StandaloneSettingsBridge', () => {
    beforeEach(() => {
        localStorage.clear();
        globalThis.chrome = {
            runtime: {
                getManifest: vi.fn(() => ({ version: '5.0.4' })),
                sendMessage: vi.fn(() =>
                    Promise.resolve({
                        action: 'MCP_TEST_RESULT',
                        ok: true,
                        toolsCount: 2,
                    })
                ),
            },
            storage: {
                local: {
                    get: vi.fn((keys, callback) =>
                        callback({
                            geminiShortcuts: { quickAsk: 'Alt+Q' },
                            geminiTextSelectionEnabled: false,
                            geminiTextSelectionBlacklist: 'github.com',
                            geminiCustomSelectionTools: [
                                {
                                    id: 'formal',
                                    name: 'Formal',
                                    prompt: 'Rewrite: {text}',
                                    enabled: true,
                                },
                            ],
                            geminiImageToolsEnabled: false,
                            geminiSidebarBehavior: 'restore',
                            geminiSidePanelScope: 'global',
                            geminiAccountIndices: '0,1',
                            geminiContextMode: 'recent',
                            geminiContextRecentTurns: 5,
                            geminiProvider: 'openai',
                            geminiOpenaiModel: 'gpt-5',
                            geminiOpenaiSelectedModel: 'gpt-5',
                        })
                    ),
                    set: vi.fn(),
                },
            },
        };
    });

    it('restores settings directly from extension storage', async () => {
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        await bridge.restoreInitialState();

        expect(controller.updateShortcuts).toHaveBeenCalledWith(
            expect.objectContaining({ quickAsk: 'Alt+Q', openPanel: 'Alt+S' })
        );
        expect(controller.updateTextSelection).toHaveBeenCalledWith(false);
        expect(controller.updateTextSelectionBlacklist).toHaveBeenCalledWith('github.com');
        expect(controller.updateCustomSelectionTools).toHaveBeenCalledWith([
            {
                id: 'formal',
                name: 'Formal',
                prompt: 'Rewrite: {text}',
                enabled: true,
            },
        ]);
        expect(controller.updateImageTools).toHaveBeenCalledWith(false);
        expect(controller.updateSidebarBehavior).toHaveBeenCalledWith('restore');
        expect(controller.updateSidePanelScope).toHaveBeenCalledWith('global');
        expect(controller.updateContextSettings).toHaveBeenCalledWith({
            mode: 'recent',
            recentTurns: 5,
        });
        expect(controller.updateConnectionSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: 'openai',
                selectedModel: 'gpt-5',
            })
        );
    });

    it('saves settings messages without the sidepanel iframe bridge', () => {
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        bridge.handleWindowMessage({
            source: window,
            data: {
                action: 'SAVE_TEXT_SELECTION_BLACKLIST',
                payload: 'github.com',
            },
        });

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            geminiTextSelectionBlacklist: 'github.com',
        });
    });

    it('saves custom selection tools without the sidepanel iframe bridge', () => {
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        bridge.handleWindowMessage({
            source: window,
            data: {
                action: 'SAVE_CUSTOM_SELECTION_TOOLS',
                payload: [{ id: 'formal', name: 'Formal', prompt: 'Rewrite: {text}' }],
            },
        });

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            geminiCustomSelectionTools: [
                { id: 'formal', name: 'Formal', prompt: 'Rewrite: {text}' },
            ],
        });
    });

    it('forwards MCP test requests and applies the response to the settings controller', async () => {
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        bridge.handleWindowMessage({
            source: window,
            data: {
                action: 'FORWARD_TO_BACKGROUND',
                payload: { action: 'MCP_TEST_CONNECTION' },
            },
        });

        await vi.waitFor(() =>
            expect(controller.updateMcpTestResult).toHaveBeenCalledWith({
                action: 'MCP_TEST_RESULT',
                ok: true,
                toolsCount: 2,
            })
        );
    });

    it('exports settings data without API keys from the standalone settings page', async () => {
        chrome.storage.local.get.mockImplementation((keys, callback) =>
            callback({
                geminiTheme: 'dark',
                geminiApiKey: 'official-secret',
                geminiOpenaiApiKey: 'openai-secret',
                geminiMcpServers: [
                    {
                        id: 'srv',
                        headers: {
                            Authorization: 'Bearer local',
                            'X-Workspace': 'docs',
                        },
                        auth: { type: 'bearer', token: 'secret' },
                    },
                ],
            })
        );
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        bridge.handleWindowMessage({
            source: window,
            data: { action: 'EXPORT_SETTINGS_DATA' },
        });

        await vi.waitFor(() => expect(downloadText).toHaveBeenCalled());
        const exported = JSON.parse(downloadText.mock.calls.at(-1)[0]);

        expect(exported.settings.geminiTheme).toBe('dark');
        expect(exported.settings).not.toHaveProperty('geminiApiKey');
        expect(exported.settings).not.toHaveProperty('geminiOpenaiApiKey');
        expect(exported.settings.geminiMcpServers[0].headers).toEqual({
            'X-Workspace': 'docs',
        });
        expect(exported.settings.geminiMcpServers[0].auth).toEqual({ type: 'bearer' });
    });

    it('imports history data from the standalone settings page', async () => {
        chrome.storage.local.get.mockImplementation((keys, callback) =>
            callback({
                geminiSessions: [{ id: 'existing', messages: [{ role: 'user' }] }],
                geminiGroups: [],
                geminiDeletedSessionIds: { imported: 1 },
            })
        );
        chrome.storage.local.set.mockImplementation((update, callback) => callback?.());
        const postSpy = vi.spyOn(window, 'postMessage');
        const controller = createController();
        const bridge = new StandaloneSettingsBridge(controller);

        bridge.handleWindowMessage({
            source: window,
            data: {
                action: 'IMPORT_HISTORY_DATA',
                payload: {
                    type: 'GeminiNexus-History',
                    history: [{ id: 'imported', messages: [{ role: 'ai' }] }],
                },
            },
        });

        await vi.waitFor(() =>
            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                {
                    geminiSessions: [
                        { id: 'existing', messages: [{ role: 'user' }] },
                        { id: 'imported', messages: [{ role: 'ai' }] },
                    ],
                    geminiGroups: [],
                    geminiDeletedSessionIds: {},
                },
                expect.any(Function)
            )
        );
        expect(postSpy).toHaveBeenCalledWith(
            {
                action: 'DATA_IMPORT_RESULT',
                payload: { kind: 'history', ok: true },
            },
            '*'
        );
    });
});
