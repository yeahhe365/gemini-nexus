// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadFile, downloadText } from './downloads.js';

describe('sidepanel downloads', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        URL.createObjectURL = vi.fn(() => 'blob:logs');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete URL.createObjectURL;
        delete URL.revokeObjectURL;
    });

    it('removes the temporary anchor when a file download click fails', () => {
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
            throw new Error('click failed');
        });

        expect(() => downloadFile('https://example.com/image.png', 'image.png')).toThrow(
            'click failed'
        );

        expect(document.body.querySelectorAll('a')).toHaveLength(0);
    });

    it('revokes object URLs when a text download click fails', () => {
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
            throw new Error('click failed');
        });

        expect(() => downloadText('debug logs', 'logs.txt')).toThrow('click failed');

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logs');
        expect(document.body.querySelectorAll('a')).toHaveLength(0);
    });

    it('uses a custom content type for text downloads', () => {
        downloadText('{"ok":true}', 'chat.json', 'application/json');

        expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/json');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logs');
    });
});
