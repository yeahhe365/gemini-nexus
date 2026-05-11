import { describe, expect, it } from 'vitest';
import {
    parseToolCommand,
    splitToolCallFromText
} from './tool_call_text.js';

const adjacentToolCalls = `{
  "tool": "fill",
  "args": {
    "uid": "1_43",
    "value": "168168\\n518518"
  }
}
\`\`\`\`\`\`json
{
  "tool": "click",
  "args": {
    "uid": "1_44"
  }
}
\`\`\`\`\`\`json
{
  "tool": "take_snapshot",
  "args": {}
}
\`\`\`\`\`\`json
{
  "tool": "fill",
  "args": {
    "uid": "1_43",
    "value": "808168\\n606168"
  }
}
\`\`\`对于六位纯数字的 .xyz 域名，价格通常很便宜。`;

describe('tool call text utilities', () => {
    it('strips adjacent malformed fenced tool calls before final prose', () => {
        expect(splitToolCallFromText(adjacentToolCalls)).toEqual({
            displayText: '对于六位纯数字的 .xyz 域名，价格通常很便宜。',
            toolCallText: '{\n  "tool": "fill",\n  "args": {\n    "uid": "1_43",\n    "value": "808168\\n606168"\n  }\n}',
            hasToolCall: true
        });
    });

    it('strips a trailing sequence of tool calls without visible prose', () => {
        const text = `I will use the page.
\`\`\`json
{"tool":"click","args":{"uid":"1_1"}}
\`\`\`
\`\`\`\`\`\`json
{"tool":"take_snapshot","args":{}}
\`\`\``;

        expect(splitToolCallFromText(text)).toEqual({
            displayText: 'I will use the page.',
            toolCallText: '{"tool":"take_snapshot","args":{}}',
            hasToolCall: true
        });
    });

    it('keeps ordinary JSON examples visible', () => {
        const text = 'Example:\n```json\n{"name":"demo","args":{}}\n```';

        expect(splitToolCallFromText(text)).toEqual({
            displayText: text,
            toolCallText: '',
            hasToolCall: false
        });
    });

    it('hides streaming tool-call prefixes before they become complete JSON', () => {
        expect(splitToolCallFromText('```json', { allowPartial: true })).toEqual({
            displayText: '',
            toolCallText: '```json',
            hasToolCall: true
        });

        expect(splitToolCallFromText('```json\n{', { allowPartial: true })).toEqual({
            displayText: '',
            toolCallText: '{',
            hasToolCall: true
        });

        expect(splitToolCallFromText('```json\n{\n  "tool": "fill"', { allowPartial: true })).toEqual({
            displayText: '',
            toolCallText: '{\n  "tool": "fill"',
            hasToolCall: true
        });
    });

    it('reveals partial JSON once it no longer looks like a tool call', () => {
        const text = '```json\n{\n  "name": "demo"';

        expect(splitToolCallFromText(text, { allowPartial: true })).toEqual({
            displayText: text,
            toolCallText: '',
            hasToolCall: false
        });
    });

    it('releases long uncertain code blocks instead of waiting for generation to finish', () => {
        const longJsonPrefix = `\`\`\`json\n{\n${' '.repeat(180)}`;

        expect(splitToolCallFromText(longJsonPrefix, { allowPartial: true })).toEqual({
            displayText: longJsonPrefix,
            toolCallText: '',
            hasToolCall: false
        });
    });

    it('continues hiding confirmed partial tool calls beyond the uncertain prefix budget', () => {
        const partialToolCall = `\`\`\`json\n{\n  "tool": "fill",\n  "args": {\n    "value": "${'1'.repeat(180)}"`;

        expect(splitToolCallFromText(partialToolCall, { allowPartial: true })).toEqual({
            displayText: '',
            toolCallText: '{\n  "tool": "fill",\n  "args": {\n    "value": "' + '1'.repeat(180) + '"',
            hasToolCall: true
        });
    });

    it('preserves prose while hiding a trailing streaming tool-call prefix', () => {
        expect(splitToolCallFromText('I will click now.\n```json\n{', { allowPartial: true })).toEqual({
            displayText: 'I will click now.',
            toolCallText: '{',
            hasToolCall: true
        });
    });

    it('preserves prose before a trailing partial fenced tool call', () => {
        expect(splitToolCallFromText('好的，我先检查一下配置状态。\n```json\n{"tool":"get_config_info","args":{}}', { allowPartial: true })).toEqual({
            displayText: '好的，我先检查一下配置状态。',
            toolCallText: '{"tool":"get_config_info","args":{}}',
            hasToolCall: true
        });
    });

    it('parses fenced tool commands without swallowing adjacent blocks', () => {
        expect(parseToolCommand(adjacentToolCalls)).toEqual({
            name: 'click',
            args: { uid: '1_44' }
        });
    });
});
