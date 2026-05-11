import { describe, expect, it } from 'vitest';
import {
    createOfficialFunctionResponseMessage,
    createOfficialFunctionResponsePart,
    createOfficialModelMessage,
    hasNativeFunctionCalls,
    parseToolCommand,
    splitToolCallFromText
} from './utils.js';

describe('session tool utilities', () => {
    it('parses fenced and trailing raw tool calls from model text', () => {
        expect(parseToolCommand('Use this:\n```json\n{"tool":"click","args":{"uid":"btn-1"}}\n```')).toEqual({
            name: 'click',
            args: { uid: 'btn-1' }
        });

        expect(parseToolCommand('Next step:\n{"tool":"fill","args":{"uid":"input-1","value":"hello"}}')).toEqual({
            name: 'fill',
            args: { uid: 'input-1', value: 'hello' }
        });
    });

    it('splits only trailing tool calls and preserves user-visible text', () => {
        expect(splitToolCallFromText('I will click now.\n```json\n{"tool":"click","args":{"uid":"btn-1"}}\n```')).toEqual({
            displayText: 'I will click now.',
            toolCallText: '{"tool":"click","args":{"uid":"btn-1"}}',
            hasToolCall: true
        });

        expect(splitToolCallFromText('This is not trailing {"tool":"click","args":{}} text')).toEqual({
            displayText: 'This is not trailing {"tool":"click","args":{}} text',
            toolCallText: '',
            hasToolCall: false
        });
    });

    it('detects and converts native official function call messages', () => {
        expect(hasNativeFunctionCalls({ functionCalls: [{ name: 'take_snapshot' }] })).toBe(true);
        expect(hasNativeFunctionCalls({ functionCalls: [{ name: '   ' }] })).toBe(false);

        expect(createOfficialFunctionResponsePart({
            id: 'call-1',
            toolName: 'take_snapshot',
            output: 'snapshot',
            status: 'completed'
        })).toEqual({
            functionResponse: {
                id: 'call-1',
                name: 'take_snapshot',
                response: {
                    output: 'snapshot',
                    status: 'completed'
                }
            }
        });

        expect(createOfficialFunctionResponseMessage([
            { toolName: 'take_snapshot', output: 'snapshot' }
        ])).toEqual({
            role: 'user',
            text: '',
            officialContent: {
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            name: 'take_snapshot',
                            response: {
                                output: 'snapshot',
                                status: 'completed'
                            }
                        }
                    }
                ]
            }
        });
    });

    it('preserves official model content for history replay', () => {
        const result = {
            text: 'Visible answer',
            thoughts: 'Reasoning',
            thoughtsDurationSeconds: 3,
            sources: [{ title: 'Source', url: 'https://example.com' }],
            images: [{ url: 'https://example.com/image.png' }],
            thoughtSignature: 'signature',
            officialContent: {
                role: 'model',
                parts: [{ text: 'Visible answer' }]
            }
        };

        expect(createOfficialModelMessage(result)).toEqual({
            role: 'ai',
            text: 'Visible answer',
            thoughts: 'Reasoning',
            thoughtsDurationSeconds: 3,
            sources: [{ title: 'Source', url: 'https://example.com' }],
            generatedImages: [{ url: 'https://example.com/image.png' }],
            thoughtSignature: 'signature',
            officialContent: {
                role: 'model',
                parts: [{ text: 'Visible answer' }]
            }
        });
    });
});
