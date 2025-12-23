
export const AppearanceSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="appearance">Appearance</h4>
    <div class="shortcut-row">
        <label data-i18n="theme">Theme</label>
        <select id="theme-select" class="shortcut-input" style="width: auto; padding: 6px 12px; text-align: left;">
            <option value="system" data-i18n="system">System Default</option>
            <option value="light" data-i18n="light">Light</option>
            <option value="dark" data-i18n="dark">Dark</option>
        </select>
    </div>
    <div class="shortcut-row">
        <label data-i18n="language">Language</label>
        <select id="language-select" class="shortcut-input" style="width: auto; padding: 6px 12px; text-align: left;">
            <option value="system" data-i18n="system">System Default</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
        </select>
    </div>
</div>`;
