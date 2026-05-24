import { describe, expect, it } from 'vitest';
import {
    CONNECTION_STORAGE_KEYS,
    createConnectionSettingsPayload,
    createConnectionStorageUpdate,
    createDefaultMcpServer,
    getConnectionProvider,
    getDefaultMcpUrlForTransport,
    getSelectedModelForProvider,
} from './connection.js';

describe('connection settings helpers', () => {
    it('builds the default connection payload used by sidepanel restore messages', () => {
        expect(createConnectionSettingsPayload({})).toEqual({
            provider: 'web',
            useOfficialApi: false,
            selectedModel: '8c46e95b1a07cecc',
            webThinkingLevel: 'high',
            openaiSelectedModel: '',
            officialBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: '',
            officialModel: 'gemini-3-flash-preview, gemini-3.1-pro-preview',
            thinkingLevel: 'low',
            officialWebSearch: false,
            openaiBaseUrl: '',
            openaiApiKey: '',
            openaiModel: '',
            openaiThinkingLevel: 'low',
            openaiUseResponsesApi: false,
            openaiWebSearch: false,
            mcpEnabled: false,
            mcpTransport: 'streamable-http',
            mcpServerUrl: 'http://127.0.0.1:3006/mcp',
            mcpServers: null,
            mcpActiveServerId: null,
        });
    });

    it('preserves OpenAI-specific selected model and legacy web-search fallback behavior', () => {
        const payload = createConnectionSettingsPayload(
            {
                geminiProvider: 'openai',
                geminiModel: 'gemini-3-flash',
                geminiOpenaiSelectedModel: 'gpt-5',
                geminiOpenaiModel: 'gpt-4.1, gpt-5',
                openaiWebSearchMode: 'chat',
            },
            { includeLegacyFallbacks: true }
        );

        expect(payload.provider).toBe('openai');
        expect(payload.selectedModel).toBe('gpt-5');
        expect(payload.openaiModel).toBe('gpt-4.1, gpt-5');
        expect(payload.openaiUseResponsesApi).toBe(false);
        expect(payload.openaiWebSearch).toBe(true);
    });

    it('normalizes provider and selected model fallback values', () => {
        expect(getConnectionProvider({ geminiUseOfficialApi: true })).toBe('official');
        expect(getConnectionProvider({})).toBe('web');
        expect(getSelectedModelForProvider({}, 'openai')).toBe('openai_custom');
        expect(getSelectedModelForProvider({}, 'web')).toBe('8c46e95b1a07cecc');
    });

    it('declares the storage keys needed for connection restore', () => {
        expect(CONNECTION_STORAGE_KEYS).toContain('geminiProvider');
        expect(CONNECTION_STORAGE_KEYS).toContain('geminiModel');
        expect(CONNECTION_STORAGE_KEYS).toContain('geminiWebThinkingLevel');
        expect(CONNECTION_STORAGE_KEYS).toContain('geminiOpenaiSelectedModel');
        expect(CONNECTION_STORAGE_KEYS).toContain('geminiMcpServers');
    });

    it('creates a shared storage update for connection saves', () => {
        expect(
            createConnectionStorageUpdate({
                provider: 'openai',
                webThinkingLevel: 'minimal',
                openaiBaseUrl: 'https://api.example.test/v1',
                openaiApiKey: 'sk-test',
                openaiModel: 'gpt-5',
                openaiUseResponsesApi: true,
                openaiWebSearch: true,
                mcpEnabled: true,
                mcpServers: [{ id: 'srv', url: 'http://localhost/mcp' }],
                mcpActiveServerId: 'srv',
            })
        ).toEqual(
            expect.objectContaining({
                geminiProvider: 'openai',
                geminiUseOfficialApi: false,
                geminiWebThinkingLevel: 'minimal',
                geminiOpenaiBaseUrl: 'https://api.example.test/v1',
                geminiOpenaiApiKey: 'sk-test',
                geminiOpenaiModel: 'gpt-5',
                geminiOpenaiUseResponsesApi: true,
                geminiOpenaiWebSearch: true,
                geminiMcpEnabled: true,
                geminiMcpTransport: 'streamable-http',
                geminiMcpServerUrl: '',
                geminiMcpServers: [{ id: 'srv', url: 'http://localhost/mcp' }],
                geminiMcpActiveServerId: 'srv',
            })
        );
    });

    it('creates default MCP server data and transport-specific URLs', () => {
        expect(createDefaultMcpServer('srv_test')).toEqual({
            id: 'srv_test',
            name: 'Local Proxy',
            transport: 'streamable-http',
            url: 'http://127.0.0.1:3006/mcp',
            headers: {},
            enabled: true,
            toolMode: 'all',
            enabledTools: [],
        });
        expect(getDefaultMcpUrlForTransport('ws')).toBe('ws://127.0.0.1:3006/mcp');
        expect(getDefaultMcpUrlForTransport('streamable-http')).toBe('http://127.0.0.1:3006/mcp');
        expect(getDefaultMcpUrlForTransport('sse')).toBe('http://127.0.0.1:3006/sse');
    });

    it('uses the shared readable ID factory for default MCP server IDs', () => {
        const server = createDefaultMcpServer();

        expect(server.id).toMatch(/^srv_[A-Z0-9-]+$/);
        expect(server.id).not.toMatch(/^srv_\d+$/);
    });
});
