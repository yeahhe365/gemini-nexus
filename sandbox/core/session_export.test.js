import { describe, expect, it } from 'vitest';
import {
    buildSessionExportFilename,
    buildSessionTextExport,
    sanitizeExportFilename,
    serializeSessionForExport,
} from './session_export.js';

describe('session export helpers', () => {
    it('sanitizes chat titles for download filenames', () => {
        expect(sanitizeExportFilename(' Research/Notes: Q&A ')).toBe('Research-Notes- Q&A');
        expect(sanitizeExportFilename('')).toBe('chat');
        expect(
            buildSessionExportFilename({ title: 'A/B' }, 'txt', new Date('2026-05-23T00:00:00Z'))
        ).toBe('gemini-nexus-A-B-2026-05-23.txt');
    });

    it('serializes a session as portable JSON without live context', () => {
        const exported = serializeSessionForExport(
            {
                id: 'session-1',
                title: 'Hello',
                context: { sensitive: true },
                messages: [{ role: 'user', text: 'Hello' }],
            },
            '2026-05-23T00:00:00.000Z'
        );

        expect(exported).toEqual({
            type: 'GeminiNexus-Chat',
            version: 1,
            exportedAt: '2026-05-23T00:00:00.000Z',
            session: {
                id: 'session-1',
                title: 'Hello',
                context: null,
                messages: [{ role: 'user', text: 'Hello' }],
            },
        });
    });

    it('builds a readable text transcript with attachments, sources, images, and thoughts', () => {
        const text = buildSessionTextExport(
            {
                title: 'Research',
                messages: [
                    {
                        role: 'user',
                        text: 'Review this',
                        attachments: [{ name: 'brief.pdf', type: 'application/pdf' }],
                    },
                    {
                        role: 'ai',
                        text: 'Looks good',
                        generatedImages: [{ alt: 'Chart', url: 'https://example.com/chart.png' }],
                        sources: [{ title: 'Docs', url: 'https://example.com/docs' }],
                        thoughts: 'Check source.',
                    },
                ],
            },
            { exportedAt: '2026-05-23T00:00:00.000Z' }
        );

        expect(text).toContain('Title: Research');
        expect(text).toContain('[1] User');
        expect(text).toContain('- brief.pdf (application/pdf)');
        expect(text).toContain('[2] Assistant');
        expect(text).toContain('- Chart: https://example.com/chart.png');
        expect(text).toContain('- Docs: https://example.com/docs');
        expect(text).toContain('Thoughts:');
    });
});
