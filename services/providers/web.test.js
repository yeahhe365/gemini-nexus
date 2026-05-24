import { describe, expect, it, vi } from 'vitest';
import { applyWebThinkingInstruction, sendWebMessage } from './web.js';

function makeStream(text) {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode(text)];
    return {
        getReader() {
            return {
                read: vi
                    .fn()
                    .mockResolvedValueOnce({ done: false, value: chunks[0] })
                    .mockResolvedValueOnce({ done: true }),
            };
        },
    };
}

function buildGeminiLine(text = 'PROJECT_OK') {
    const candidate = [];
    candidate[0] = 'rc_1';
    candidate[1] = [text];

    const payload = [];
    payload[1] = ['c_1', 'r_1'];
    payload[4] = [candidate];

    return `)]}'${JSON.stringify([['wrb.fr', null, JSON.stringify(payload)]])}\n`;
}

describe('sendWebMessage', () => {
    it('applies Gemini Web thinking instructions only for non-high modes', () => {
        expect(applyWebThinkingInstruction('Solve it.', '8c46e95b1a07cecc', 'minimal')).toContain(
            'Gemini Nexus thinking mode: Minimal'
        );
        expect(applyWebThinkingInstruction('Solve it.', '8c46e95b1a07cecc', 'high')).toBe(
            'Solve it.'
        );
        expect(applyWebThinkingInstruction('Solve it.', 'e6fa609c3fa255c0', 'minimal')).toContain(
            'Gemini Nexus thinking mode: Low'
        );
    });

    it('uses current Gemini web endpoint query and request headers while preserving stream parsing', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: makeStream(buildGeminiLine()),
        });

        const context = {
            atValue: 'at-token',
            blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
            fSid: '3956664217185504700',
            locale: 'zh-CN',
            authUser: '0',
        };

        const response = await sendWebMessage(
            '只回复 PROJECT_OK',
            context,
            '56fdd199312815e2',
            [],
            undefined
        );

        expect(response.text).toBe('PROJECT_OK');
        expect(response.newContext).not.toHaveProperty('contextIds');

        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toContain(
            'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?'
        );
        expect(url).toContain('bl=boq_assistant-bard-web-server_20260511.16_p5');
        expect(url).toContain('f.sid=3956664217185504700');
        expect(url).toContain('hl=zh-CN');
        expect(url).not.toContain('/u/0/_/BardChatUi');

        expect(init.headers['x-goog-ext-73010989-jspb']).toBe('[0]');
        expect(init.headers['x-goog-ext-73010990-jspb']).toBe('[0,0,0]');
        expect(init.headers['x-goog-ext-525005358-jspb']).toMatch(/^\["[0-9A-F-]{36}",1\]$/);
        expect(init.headers['x-goog-ext-525001261-jspb']).toContain('56fdd199312815e2');

        const body = init.body;
        expect(body.get('at')).toBe('at-token');
        expect(body.get('f.req')).toContain('只回复 PROJECT_OK');
    });

    it('sends the selected Gemini Web thinking mode inside the request payload', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: makeStream(buildGeminiLine()),
        });

        await sendWebMessage(
            '只回复 PROJECT_OK',
            {
                atValue: 'at-token',
                blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
                fSid: '3956664217185504700',
                locale: 'zh-CN',
                authUser: '0',
            },
            '8c46e95b1a07cecc',
            [],
            undefined,
            undefined,
            { thinkingLevel: 'minimal' }
        );

        const [, init] = global.fetch.mock.calls[0];
        const fReq = init.body.get('f.req');
        expect(fReq).toContain('Gemini Nexus thinking mode: Minimal');
        expect(fReq).toContain('只回复 PROJECT_OK');
    });

    it('does not send, persist, or mutate stale native three-id conversation context', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: makeStream(buildGeminiLine()),
        });

        const context = {
            atValue: 'at-token',
            blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
            fSid: '3956664217185504700',
            locale: 'zh-CN',
            authUser: '0',
            contextIds: ['stale-conversation', 'stale-response', 'stale-choice'],
        };

        const response = await sendWebMessage(
            '只回复 PROJECT_OK',
            context,
            '8c46e95b1a07cecc',
            [],
            undefined
        );

        const [, init] = global.fetch.mock.calls[0];
        const fReq = init.body.get('f.req');

        expect(fReq).not.toContain('stale-conversation');
        expect(fReq).not.toContain('stale-response');
        expect(fReq).not.toContain('stale-choice');
        expect(JSON.parse(JSON.parse(fReq)[1])[2]).toEqual(['', '', '']);
        expect(response.newContext).not.toHaveProperty('contextIds');
        expect(context.contextIds).toEqual([
            'stale-conversation',
            'stale-response',
            'stale-choice',
        ]);
    });

    it('rejects removed Web image-preview models instead of sending them', async () => {
        global.fetch = vi.fn();

        await expect(
            sendWebMessage(
                '生成一张图片',
                {
                    atValue: 'at-token',
                    blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
                    fSid: '3956664217185504700',
                    locale: 'zh-CN',
                    authUser: '0',
                },
                'gemini-3-pro-image-preview-11-2025',
                [],
                undefined
            )
        ).rejects.toThrow('Unsupported Gemini Web model: gemini-3-pro-image-preview-11-2025');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('passes current Gemini upload tokens through file uploads before streaming', async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'X-Goog-Upload-URL': 'https://push.clients6.google.com/upload/session',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: () => Promise.resolve('/contrib_service/ttl_1d/upload-id'),
            })
            .mockResolvedValueOnce({
                ok: true,
                body: makeStream(buildGeminiLine()),
            });

        const context = {
            atValue: 'at-token',
            blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
            fSid: '3956664217185504700',
            locale: 'zh-CN',
            authUser: '0',
            uploadPushId: 'feeds/upload-dynamic',
            uploadClientPctx: 'client-pctx-token',
        };

        await sendWebMessage(
            '分析这张图',
            context,
            '8c46e95b1a07cecc',
            [
                {
                    name: 'image.png',
                    base64: 'data:image/png;base64,AAAA',
                },
            ],
            undefined
        );

        const [uploadUrl, uploadInit] = global.fetch.mock.calls[0];
        expect(uploadUrl).toBe('https://push.clients6.google.com/upload/');
        expect(uploadInit.headers).toEqual({
            'Push-ID': 'feeds/upload-dynamic',
            'X-Tenant-Id': 'bard-storage',
            'X-Client-Pctx': 'client-pctx-token',
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
        });
        expect(uploadInit.credentials).toBe('include');

        const [uploadSessionUrl, uploadSessionInit] = global.fetch.mock.calls[1];
        expect(uploadSessionUrl).toBe('https://push.clients6.google.com/upload/session');
        expect(uploadSessionInit.headers).toEqual({
            'Push-ID': 'feeds/upload-dynamic',
            'X-Tenant-Id': 'bard-storage',
            'X-Client-Pctx': 'client-pctx-token',
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Offset': '0',
        });

        const [, streamInit] = global.fetch.mock.calls[2];
        expect(streamInit.body.get('f.req')).toContain('/contrib_service/ttl_1d/upload-id');
    });

    it('rejects unknown Web model names instead of silently falling back', async () => {
        global.fetch = vi.fn();

        await expect(
            sendWebMessage(
                'hello',
                {
                    atValue: 'at-token',
                    blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
                    fSid: '3956664217185504700',
                    locale: 'zh-CN',
                    authUser: '0',
                },
                'gemini-unknown',
                [],
                undefined
            )
        ).rejects.toThrow('Unsupported Gemini Web model: gemini-unknown');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects incomplete Web auth context instead of using an obsolete bl fallback', async () => {
        global.fetch = vi.fn();

        await expect(
            sendWebMessage(
                'hello',
                {
                    atValue: 'at-token',
                    fSid: '3956664217185504700',
                    locale: 'zh-CN',
                    authUser: '0',
                },
                '8c46e95b1a07cecc',
                [],
                undefined
            )
        ).rejects.toThrow('Missing Gemini Web auth token: blValue');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
