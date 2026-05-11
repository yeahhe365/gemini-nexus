import { describe, expect, it } from 'vitest';
import { extractOfficialResponseData } from './official.js';

describe('extractOfficialResponseData', () => {
    it('extracts visible text, thoughts, signatures, and function calls', () => {
        const result = extractOfficialResponseData({
            content: {
                role: 'model',
                parts: [
                    { text: 'Thinking...', thought: true, thoughtSignature: 'sig-1' },
                    { text: 'Visible answer.' },
                    { functionCall: { id: 'call-1', name: 'take_snapshot', args: { uid: 'root' } } },
                    { functionCall: { id: 'call-1', name: 'take_snapshot', args: { uid: 'root' } } },
                    { thought: 'More reasoning.' }
                ]
            },
            groundingMetadata: {
                groundingChunks: [
                    { web: { uri: 'https://example.com/source', title: 'Example' } }
                ]
            }
        });

        expect(result).toEqual({
            text: 'Visible answer.',
            thoughts: 'Thinking...More reasoning.',
            thoughtSignature: 'sig-1',
            officialContent: {
                role: 'model',
                parts: [
                    { text: 'Thinking...', thought: true, thoughtSignature: 'sig-1' },
                    { text: 'Visible answer.' },
                    { functionCall: { id: 'call-1', name: 'take_snapshot', args: { uid: 'root' } } },
                    { functionCall: { id: 'call-1', name: 'take_snapshot', args: { uid: 'root' } } },
                    { thought: 'More reasoning.' }
                ]
            },
            functionCalls: [
                {
                    id: 'call-1',
                    name: 'take_snapshot',
                    args: { uid: 'root' },
                    partIndex: 2
                }
            ]
        });
    });

    it('returns an empty result for malformed candidates', () => {
        expect(extractOfficialResponseData({})).toEqual({
            text: '',
            thoughts: '',
            thoughtSignature: null,
            officialContent: null,
            functionCalls: []
        });
    });
});
