
export const AboutSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="system">System</h4>
    <div class="shortcut-row">
        <label data-i18n="debugLogs">Debug Logs</label>
        <button id="download-logs" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" data-i18n="downloadLogs">Download Logs</button>
    </div>
</div>

<div class="setting-group">
    <h4 data-i18n="about">About</h4>
    <p class="setting-info"><strong>Gemini Nexus</strong> v4.1.2</p>
    
    <div style="display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap;">
        <a href="https://github.com/yeahhe365/gemini-nexus" target="_blank" class="github-link" style="margin-top: 0;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            <span data-i18n="sourceCode">Source Code</span>
            <span id="star-count" class="star-badge"></span>
        </a>
        
        <a href="https://github.com/yeahhe365/gemini-nexus/blob/main/README.md" target="_blank" class="github-link" style="margin-top: 0;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                <line x1="6" y1="1" x2="6" y2="4"></line>
                <line x1="10" y1="1" x2="10" y2="4"></line>
                <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span data-i18n="buyMeCoffee">Buy Me a Coffee</span>
        </a>
    </div>
</div>`;
