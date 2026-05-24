import { describe, expect, it } from 'vitest';

import {
    buildHistoryExportPayload,
    buildSettingsExportPayload,
    mergeImportedRecords,
    buildHistoryImportStorageUpdate,
    buildSettingsImportStorageUpdate,
    normalizeHistoryImportPayload,
    normalizeSettingsImportPayload,
} from './index.js';

describe('data management helpers', () => {
    it('exports history without live session context', () => {
        const payload = buildHistoryExportPayload(
            {
                geminiSessions: [{ id: 'chat-1', context: { token: 'secret' }, messages: [] }],
                geminiGroups: [{ id: 'group-1', title: 'Work' }],
            },
            '2026-05-24T00:00:00.000Z'
        );

        expect(payload).toEqual({
            type: 'GeminiNexus-History',
            version: 1,
            exportedAt: '2026-05-24T00:00:00.000Z',
            history: [{ id: 'chat-1', context: null, messages: [] }],
            groups: [{ id: 'group-1', title: 'Work' }],
        });
    });

    it('redacts API keys and sensitive MCP headers from settings exports', () => {
        const payload = buildSettingsExportPayload({
            geminiApiKey: 'gemini-key',
            geminiOpenaiApiKey: 'openai-key',
            geminiTheme: 'dark',
            geminiMcpServers: [
                {
                    id: 'srv',
                    headers: {
                        Authorization: 'Bearer local',
                        'X-Trace': 'ok',
                        'api-key': 'secret',
                    },
                    env: { TOKEN: 'secret' },
                    auth: { type: 'bearer', token: 'secret' },
                },
            ],
        });

        expect(payload.settings).not.toHaveProperty('geminiApiKey');
        expect(payload.settings).not.toHaveProperty('geminiOpenaiApiKey');
        expect(payload.settings.geminiTheme).toBe('dark');
        expect(payload.settings.geminiMcpServers[0]).toEqual(
            expect.objectContaining({
                headers: { 'X-Trace': 'ok' },
                env: {},
                auth: { type: 'bearer' },
            })
        );
    });

    it('normalizes import payloads and filters settings keys to the allowlist', () => {
        expect(
            normalizeHistoryImportPayload({
                type: 'GeminiNexus-History',
                history: [{ id: 'chat-1' }],
            })
        ).toEqual({ sessions: [{ id: 'chat-1' }], groups: [] });

        expect(
            normalizeSettingsImportPayload({
                type: 'GeminiNexus-Settings',
                settings: {
                    geminiTheme: 'light',
                    unrelated: 'ignored',
                },
            })
        ).toEqual({ geminiTheme: 'light' });
    });

    it('does not import settings secrets from external files', () => {
        expect(
            normalizeSettingsImportPayload({
                type: 'GeminiNexus-Settings',
                settings: {
                    geminiApiKey: 'official-secret',
                    geminiOpenaiApiKey: 'openai-secret',
                    geminiMcpServers: [
                        {
                            headers: {
                                Authorization: 'Bearer token',
                                'X-Workspace': 'docs',
                            },
                            env: { API_TOKEN: 'secret' },
                            auth: { type: 'bearer', token: 'secret' },
                        },
                    ],
                },
            })
        ).toEqual({
            geminiMcpServers: [
                {
                    headers: { 'X-Workspace': 'docs' },
                    env: {},
                    auth: { type: 'bearer' },
                },
            ],
        });
    });

    it('merges imported records without replacing existing ids', () => {
        expect(
            mergeImportedRecords(
                [{ id: 'existing', title: 'A' }],
                [
                    { id: 'existing', title: 'Imported A' },
                    { id: 'new', title: 'B' },
                ]
            )
        ).toEqual([
            { id: 'existing', title: 'A' },
            { id: 'new', title: 'B' },
        ]);
    });

    it('builds history and settings import storage updates', () => {
        expect(
            buildHistoryImportStorageUpdate(
                {
                    type: 'GeminiNexus-History',
                    history: [{ id: 'new-session' }],
                    groups: [{ id: 'new-group' }],
                },
                {
                    geminiSessions: [{ id: 'existing-session' }],
                    geminiGroups: [{ id: 'existing-group' }],
                    geminiDeletedSessionIds: { 'new-session': 1, other: 2 },
                }
            )
        ).toEqual({
            geminiSessions: [{ id: 'existing-session' }, { id: 'new-session' }],
            geminiGroups: [{ id: 'existing-group' }, { id: 'new-group' }],
            geminiDeletedSessionIds: { other: 2 },
        });

        expect(
            buildSettingsImportStorageUpdate({
                type: 'GeminiNexus-Settings',
                settings: { geminiTheme: 'dark', unknown: true },
            })
        ).toEqual({ geminiTheme: 'dark' });
    });
});
