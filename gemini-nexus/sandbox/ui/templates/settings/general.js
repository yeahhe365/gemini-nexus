
export const GeneralSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="general">General</h4>
    
    <div class="shortcut-row" style="margin-bottom: 12px;">
        <div style="flex: 1;">
            <label data-i18n="textSelection" style="font-weight: 500; display: block; margin-bottom: 2px;">Text Selection Toolbar</label>
            <span class="setting-desc" data-i18n="textSelectionDesc">Show floating toolbar when selecting text.</span>
        </div>
        <input type="checkbox" id="text-selection-toggle" style="width: 20px; height: 20px; cursor: pointer;">
    </div>

    <div class="shortcut-row" style="margin-bottom: 12px;">
        <div style="flex: 1;">
            <label data-i18n="imageToolsToggle" style="font-weight: 500; display: block; margin-bottom: 2px;">Show Image Tools Button</label>
            <span class="setting-desc" data-i18n="imageToolsToggleDesc">Show the AI button when hovering over images.</span>
        </div>
        <input type="checkbox" id="image-tools-toggle" style="width: 20px; height: 20px; cursor: pointer;">
    </div>

    <div class="shortcut-row" style="margin-bottom: 12px; align-items: flex-start;">
        <div style="flex: 1; margin-right: 12px;">
            <label data-i18n="accountIndices" style="font-weight: 500; display: block; margin-bottom: 2px;">Account Indices</label>
            <span class="setting-desc" data-i18n="accountIndicesDesc">Comma-separated user indices (e.g., 0, 1, 2) for polling.</span>
        </div>
        <input type="text" id="account-indices-input" class="shortcut-input" style="width: 100px; text-align: left;" placeholder="0">
    </div>

    <div style="margin-top: 16px;">
        <h5 data-i18n="sidebarBehavior" style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">When Sidebar Reopens</h5>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                <input type="radio" name="sidebar-behavior" value="auto" style="margin-top: 3px;">
                <div>
                    <div data-i18n="sidebarBehaviorAuto" style="font-weight: 500; font-size: 14px; color: var(--text-primary);">Auto restore or restart</div>
                    <div data-i18n="sidebarBehaviorAutoDesc" style="font-size: 12px; color: var(--text-tertiary);">Restore if opened within 10 mins, otherwise start new chat.</div>
                </div>
            </label>
            
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="sidebar-behavior" value="restore">
                <span data-i18n="sidebarBehaviorRestore" style="font-size: 14px; color: var(--text-primary);">Always restore previous chat</span>
            </label>
            
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="sidebar-behavior" value="new">
                <span data-i18n="sidebarBehaviorNew" style="font-size: 14px; color: var(--text-primary);">Always start new chat</span>
            </label>
        </div>
    </div>
</div>`;
