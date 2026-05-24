// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutSection } from './about.js';

describe('AboutSection', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = `
            <div id="about-settings-group">
                <button id="download-logs"></button>
                <button id="export-history-data"></button>
                <button id="import-history-data"></button>
                <input id="import-history-file" type="file">
                <button id="export-settings-data"></button>
                <button id="import-settings-data"></button>
                <input id="import-settings-file" type="file">
                <span id="star-count"></span>
                <span id="app-current-version"></span>
                <span id="app-update-status"></span>
            </div>
        `;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders update versions as text inside the release link', () => {
        const section = new AboutSection();

        section.displayUpdateStatus('<img src=x onerror="alert(1)">2.0.0', '1.0.0', true);

        const updateStatus = document.getElementById('app-update-status');
        const link = updateStatus.querySelector('a.app-update-link');
        expect(link).not.toBeNull();
        expect(link.textContent).toBe('Update available: <img src=x onerror="alert(1)">2.0.0');
        expect(updateStatus.querySelector('img')).toBeNull();
        expect(updateStatus.classList.contains('is-muted')).toBe(false);
        expect(updateStatus.hasAttribute('style')).toBe(false);
    });

    it('uses classes for star and latest-version presentation states', () => {
        const section = new AboutSection();

        section.displayStars(1200);
        const star = document.getElementById('star-count');
        expect(star.textContent).toBe('★ 1.2k');
        expect(star.classList.contains('is-visible')).toBe(true);
        expect(star.hasAttribute('style')).toBe(false);

        section.displayStars(0);
        expect(star.classList.contains('is-visible')).toBe(false);
        expect(star.hasAttribute('style')).toBe(false);

        section.displayUpdateStatus('1.0.0', '1.0.0', false);
        const updateStatus = document.getElementById('app-update-status');
        expect(updateStatus.classList.contains('is-muted')).toBe(true);
        expect(updateStatus.hasAttribute('style')).toBe(false);
    });

    it('fires export callbacks and opens import file pickers', () => {
        const callbacks = {
            onExportHistory: vi.fn(),
            onExportSettings: vi.fn(),
        };
        new AboutSection(callbacks);
        const historyInput = document.getElementById('import-history-file');
        const settingsInput = document.getElementById('import-settings-file');
        const historyClick = vi.spyOn(historyInput, 'click').mockImplementation(() => {});
        const settingsClick = vi.spyOn(settingsInput, 'click').mockImplementation(() => {});

        document.getElementById('export-history-data').click();
        document.getElementById('export-settings-data').click();
        document.getElementById('import-history-data').click();
        document.getElementById('import-settings-data').click();

        expect(callbacks.onExportHistory).toHaveBeenCalled();
        expect(callbacks.onExportSettings).toHaveBeenCalled();
        expect(historyClick).toHaveBeenCalled();
        expect(settingsClick).toHaveBeenCalled();
    });

    it('reads selected JSON import files before firing import callbacks', () => {
        const callbacks = {
            onImportHistory: vi.fn(),
        };
        new AboutSection(callbacks);
        const input = document.getElementById('import-history-file');
        Object.defineProperty(input, 'files', {
            value: [{ name: 'history.json' }],
            configurable: true,
        });
        vi.stubGlobal(
            'FileReader',
            class {
                readAsText() {
                    this.result = '{"type":"GeminiNexus-History","history":[]}';
                    this.onload();
                }
            }
        );

        input.dispatchEvent(new Event('change'));

        expect(callbacks.onImportHistory).toHaveBeenCalledWith({
            type: 'GeminiNexus-History',
            history: [],
        });
        expect(input.value).toBe('');
    });

    it('alerts when an import file cannot be parsed', () => {
        const callbacks = {
            onImportSettings: vi.fn(),
        };
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        new AboutSection(callbacks);
        const input = document.getElementById('import-settings-file');
        Object.defineProperty(input, 'files', {
            value: [{ name: 'settings.json' }],
            configurable: true,
        });
        vi.stubGlobal(
            'FileReader',
            class {
                readAsText() {
                    this.result = 'not json';
                    this.onload();
                }
            }
        );

        input.dispatchEvent(new Event('change'));

        expect(callbacks.onImportSettings).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith('Failed to read import file.');
    });
});
