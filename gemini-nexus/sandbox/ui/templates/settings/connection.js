
export const ConnectionSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="connection">Connection</h4>
    <div class="shortcut-row" style="margin-bottom: 12px; align-items: flex-start;">
        <div style="flex: 1; margin-right: 12px;">
            <label data-i18n="useOfficialApi" style="font-weight: 500; display: block; margin-bottom: 2px;">Use Official Gemini API</label>
            <span class="setting-desc" data-i18n="useOfficialApiDesc">Use your own API key with Gemini 3 models.</span>
        </div>
        <input type="checkbox" id="use-official-api-toggle" style="width: 20px; height: 20px; cursor: pointer; margin-top: 4px;">
    </div>
    
    <div id="api-key-container" style="display: none; flex-direction: column; gap: 12px; margin-bottom: 12px;">
        <div>
            <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
            <input type="password" id="api-key-input" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Paste your Gemini API Key">
        </div>
        <div>
            <label style="font-weight: 500; display: block; margin-bottom: 2px;">Thinking Level (Gemini 3)</label>
            <select id="thinking-level-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                <option value="minimal">Minimal (Flash Only)</option>
                <option value="low">Low (Faster)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Deep Reasoning)</option>
            </select>
        </div>
    </div>
</div>`;