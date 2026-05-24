import { describe, expect, it } from 'vitest';

import {
    buildConnectionSettingsForSave,
    buildContextSettingsForSave,
    normalizeAccountIndices,
} from './settings_save.js';
import { DEFAULT_CONTEXT_RECENT_TURNS } from '../../../shared/config/constants.js';

describe('settings save helpers', () => {
    it('normalizes comma-separated account indices before saving', () => {
        expect(normalizeAccountIndices('0, abc, 2, ,03')).toBe('0,2,03');
        expect(normalizeAccountIndices('abc')).toBe('0');
    });

    it('clamps context recent turns to the supported settings range', () => {
        expect(
            buildContextSettingsForSave({ contextMode: 'recent', contextRecentTurns: 99 })
        ).toEqual({
            mode: 'recent',
            recentTurns: 50,
        });
        expect(
            buildContextSettingsForSave({ contextMode: 'summary', contextRecentTurns: 'bad' })
        ).toMatchObject({
            mode: 'summary',
            recentTurns: DEFAULT_CONTEXT_RECENT_TURNS,
        });
    });

    it('preserves the currently selected OpenAI model while saving connection form data', () => {
        expect(
            buildConnectionSettingsForSave(
                {
                    provider: 'openai',
                    openaiModel: 'gpt-5,gpt-5-mini',
                    openaiUseResponsesApi: true,
                    openaiWebSearch: true,
                    mcpServers: [{ id: 'srv-1', url: 'http://localhost/mcp' }],
                },
                { openaiSelectedModel: 'gpt-5-mini', webThinkingLevel: 'minimal' }
            )
        ).toMatchObject({
            provider: 'openai',
            webThinkingLevel: 'minimal',
            openaiModel: 'gpt-5,gpt-5-mini',
            openaiSelectedModel: 'gpt-5-mini',
            openaiUseResponsesApi: true,
            openaiWebSearch: true,
            mcpServers: [{ id: 'srv-1', url: 'http://localhost/mcp' }],
        });
    });
});
