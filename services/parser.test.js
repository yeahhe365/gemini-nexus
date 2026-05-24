import { describe, expect, it } from 'vitest';
import { parseGeminiLine } from './parser.js';

function buildLine({ text = 'Hello', thoughts = null, extraCandidateParts = [] } = {}) {
    const candidate = [];
    candidate[0] = 'choice-1';
    candidate[1] = [text];
    if (thoughts) {
        candidate[37] = [[thoughts]];
    }
    extraCandidateParts.forEach((part, index) => {
        candidate[10 + index] = part;
    });

    const payload = [];
    payload[1] = ['conversation-1', 'response-1'];
    payload[4] = [candidate];

    return `)]}'${JSON.stringify([['wrb.fr', null, JSON.stringify(payload)]])}`;
}

describe('parseGeminiLine', () => {
    it('extracts text, thoughts, ids, and generated image URLs from Gemini web payloads', () => {
        const line = buildLine({
            text: 'Image: https://googleusercontent.com/image_generation_content/0',
            thoughts: 'Internal reasoning',
            extraCandidateParts: [
                [
                    'http://lh3.googleusercontent.com/generated-image',
                    '//example.invalid/not-google',
                    '//ggpht.com/generated-image-2',
                    'https://googleusercontent.com/image_generation_content/0',
                ],
            ],
        });

        expect(parseGeminiLine(line)).toEqual({
            text: 'Image:',
            thoughts: 'Internal reasoning',
            images: [
                {
                    url: 'https://lh3.googleusercontent.com/generated-image',
                    alt: 'Generated Image',
                },
                {
                    url: 'https://ggpht.com/generated-image-2',
                    alt: 'Generated Image',
                },
            ],
            hasGeneratedImagePlaceholder: true,
            ids: ['conversation-1', 'response-1', 'choice-1'],
        });
    });

    it('returns null for malformed or unrelated stream lines', () => {
        expect(parseGeminiLine('')).toBeNull();
        expect(parseGeminiLine('not-json')).toBeNull();
        expect(parseGeminiLine(JSON.stringify({ not: 'an envelope' }))).toBeNull();
        expect(parseGeminiLine(JSON.stringify([['wrb.fr', null, '{"bad":true}']]))).toBeNull();
    });
});
