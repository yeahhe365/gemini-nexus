// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsController } from './index.js';
import { SettingsModalTemplate } from '../templates/settings/index.js';

vi.mock('../../../shared/messaging/index.js', () => ({
    requestAccountIndicesFromStorage: vi.fn(),
    requestConnectionSettingsFromStorage: vi.fn(),
    requestCustomSelectionToolsFromStorage: vi.fn(),
    requestContextSettingsFromStorage: vi.fn(),
    requestImageToolsFromStorage: vi.fn(),
    requestTextSelectionBlacklistFromStorage: vi.fn(),
    requestTextSelectionFromStorage: vi.fn(),
    exportHistoryData: vi.fn(),
    importHistoryData: vi.fn(),
    exportSettingsData: vi.fn(),
    importSettingsData: vi.fn(),
    saveAccountIndicesToStorage: vi.fn(),
    saveConnectionSettingsToStorage: vi.fn(),
    saveCustomSelectionToolsToStorage: vi.fn(),
    saveContextSettingsToStorage: vi.fn(),
    saveImageToolsToStorage: vi.fn(),
    saveLanguageToStorage: vi.fn(),
    saveShortcutsToStorage: vi.fn(),
    saveSidebarBehaviorToStorage: vi.fn(),
    saveSidePanelScopeToStorage: vi.fn(),
    saveTextSelectionBlacklistToStorage: vi.fn(),
    saveTextSelectionToStorage: vi.fn(),
    saveThemeToStorage: vi.fn(),
    sendToBackground: vi.fn(),
}));

describe('SettingsController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.matchMedia = vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        document.body.innerHTML = `
            <button id="settings-btn"></button>
            ${SettingsModalTemplate}
        `;
    });

    it('does not open the sidepanel settings modal when the sidebar settings button is clicked', () => {
        new SettingsController();

        document.getElementById('settings-btn').click();

        expect(document.getElementById('settings-modal').classList.contains('visible')).toBe(false);
    });

    it('cleans account indices before saving and reflects the saved value in the form', async () => {
        const { saveAccountIndicesToStorage } = await import('../../../shared/messaging/index.js');
        const controller = new SettingsController();
        const formData = controller.view.getFormData();
        formData.accountIndices = '0, abc, 2';

        controller.saveSettings(formData);

        expect(saveAccountIndicesToStorage).toHaveBeenCalledWith('0,2');
        expect(document.getElementById('account-indices-input').value).toBe('0,2');
    });

    it('cleans custom selection tools before saving and reflects the saved list', async () => {
        const { saveCustomSelectionToolsToStorage } =
            await import('../../../shared/messaging/index.js');
        const controller = new SettingsController();
        const formData = controller.view.getFormData();
        formData.customSelectionTools = [
            {
                id: 'formal',
                name: ' Formal ',
                prompt: 'Rewrite: {text}',
                enabled: true,
            },
            {
                id: 'empty',
                name: 'Empty',
                prompt: '',
                enabled: true,
            },
        ];

        controller.saveSettings(formData);

        expect(saveCustomSelectionToolsToStorage).toHaveBeenCalledWith([
            {
                id: 'formal',
                name: 'Formal',
                prompt: 'Rewrite: {text}',
                enabled: true,
            },
        ]);
        expect(document.querySelectorAll('.custom-selection-tool-row')).toHaveLength(1);
        expect(document.querySelector('.custom-selection-tool-name').value).toBe('Formal');
    });
});
