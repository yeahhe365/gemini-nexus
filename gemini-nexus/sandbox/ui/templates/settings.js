
import { ConnectionSettingsTemplate } from './settings/connection.js';
import { GeneralSettingsTemplate } from './settings/general.js';
import { AppearanceSettingsTemplate } from './settings/appearance.js';
import { ShortcutsSettingsTemplate } from './settings/shortcuts.js';
import { AboutSettingsTemplate } from './settings/about.js';

export const SettingsTemplate = `
    <!-- SETTINGS -->
    <div id="settings-modal" class="settings-modal">
        <div class="settings-content">
            <div class="settings-header">
                <h3 data-i18n="settingsTitle">Settings</h3>
                <button id="close-settings" class="icon-btn small" data-i18n-title="close" title="Close">✕</button>
            </div>
            <div class="settings-body">
                ${ConnectionSettingsTemplate}
                ${GeneralSettingsTemplate}
                ${AppearanceSettingsTemplate}
                ${ShortcutsSettingsTemplate}
                ${AboutSettingsTemplate}
            </div>
        </div>
    </div>
`;
