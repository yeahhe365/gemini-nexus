
export const AppearanceSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="appearance">Appearance</h4>

    <div class="setting-panel">
        <div class="setting-panel-grid setting-panel-grid-even">
            <label class="setting-field">
                <span data-i18n="theme">Theme</span>
                <select id="theme-select" class="shortcut-input">
                    <option value="system" data-i18n="system">System Default</option>
                    <option value="light" data-i18n="light">Light</option>
                    <option value="dark" data-i18n="dark">Dark</option>
                </select>
            </label>

            <label class="setting-field">
                <span data-i18n="language">Language</span>
                <select id="language-select" class="shortcut-input">
                    <option value="system" data-i18n="system">System Default</option>
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                </select>
            </label>
        </div>
    </div>
</div>`;
