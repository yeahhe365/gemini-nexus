export function sendToBackground(payload) {
    window.parent.postMessage(
        {
            action: 'FORWARD_TO_BACKGROUND',
            payload,
        },
        '*'
    );
}

export function saveSessionsToStorage(sessions, mutation = null) {
    window.parent.postMessage(
        {
            action: 'SAVE_SESSIONS',
            payload: mutation ? { sessions, mutation } : sessions,
        },
        '*'
    );
}

export function saveGroupsToStorage(groups) {
    window.parent.postMessage(
        {
            action: 'SAVE_GROUPS',
            payload: Array.isArray(groups) ? groups : [],
        },
        '*'
    );
}

export function downloadTextFile(text, filename, contentType = 'text/plain') {
    window.parent.postMessage(
        {
            action: 'DOWNLOAD_TEXT',
            payload: {
                text,
                filename,
                contentType,
            },
        },
        '*'
    );
}

export function exportHistoryData() {
    window.parent.postMessage({ action: 'EXPORT_HISTORY_DATA' }, '*');
}

export function importHistoryData(payload) {
    window.parent.postMessage(
        {
            action: 'IMPORT_HISTORY_DATA',
            payload,
        },
        '*'
    );
}

export function exportSettingsData() {
    window.parent.postMessage({ action: 'EXPORT_SETTINGS_DATA' }, '*');
}

export function importSettingsData(payload) {
    window.parent.postMessage(
        {
            action: 'IMPORT_SETTINGS_DATA',
            payload,
        },
        '*'
    );
}

export function saveShortcutsToStorage(shortcuts) {
    window.parent.postMessage(
        {
            action: 'SAVE_SHORTCUTS',
            payload: shortcuts,
        },
        '*'
    );
}

export function saveThemeToStorage(theme) {
    window.parent.postMessage(
        {
            action: 'SAVE_THEME',
            payload: theme,
        },
        '*'
    );
}

export function saveLanguageToStorage(lang) {
    window.parent.postMessage(
        {
            action: 'SAVE_LANGUAGE',
            payload: lang,
        },
        '*'
    );
}

export function requestTextSelectionFromStorage() {
    window.parent.postMessage({ action: 'GET_TEXT_SELECTION' }, '*');
}

export function saveTextSelectionToStorage(enabled) {
    window.parent.postMessage(
        {
            action: 'SAVE_TEXT_SELECTION',
            payload: enabled,
        },
        '*'
    );
}

export function requestTextSelectionBlacklistFromStorage() {
    window.parent.postMessage({ action: 'GET_TEXT_SELECTION_BLACKLIST' }, '*');
}

export function saveTextSelectionBlacklistToStorage(value) {
    window.parent.postMessage(
        {
            action: 'SAVE_TEXT_SELECTION_BLACKLIST',
            payload: value,
        },
        '*'
    );
}

export function requestCustomSelectionToolsFromStorage() {
    window.parent.postMessage({ action: 'GET_CUSTOM_SELECTION_TOOLS' }, '*');
}

export function saveCustomSelectionToolsToStorage(tools) {
    window.parent.postMessage(
        {
            action: 'SAVE_CUSTOM_SELECTION_TOOLS',
            payload: Array.isArray(tools) ? tools : [],
        },
        '*'
    );
}

export function requestImageToolsFromStorage() {
    window.parent.postMessage({ action: 'GET_IMAGE_TOOLS' }, '*');
}

export function saveImageToolsToStorage(enabled) {
    window.parent.postMessage(
        {
            action: 'SAVE_IMAGE_TOOLS',
            payload: enabled,
        },
        '*'
    );
}

export function saveSidebarBehaviorToStorage(behavior) {
    window.parent.postMessage(
        {
            action: 'SAVE_SIDEBAR_BEHAVIOR',
            payload: behavior,
        },
        '*'
    );
}

export function requestSidebarExpandedFromStorage() {
    window.parent.postMessage({ action: 'GET_SIDEBAR_EXPANDED' }, '*');
}

export function saveSidebarExpandedToStorage(isExpanded) {
    window.parent.postMessage(
        {
            action: 'SAVE_SIDEBAR_EXPANDED',
            payload: Boolean(isExpanded),
        },
        '*'
    );
}

export function saveSidePanelScopeToStorage(scope) {
    window.parent.postMessage(
        {
            action: 'SAVE_SIDE_PANEL_SCOPE',
            payload: scope,
        },
        '*'
    );
}

export function requestAccountIndicesFromStorage() {
    window.parent.postMessage({ action: 'GET_ACCOUNT_INDICES' }, '*');
}

export function saveAccountIndicesToStorage(indices) {
    window.parent.postMessage(
        {
            action: 'SAVE_ACCOUNT_INDICES',
            payload: indices,
        },
        '*'
    );
}

export function requestContextSettingsFromStorage() {
    window.parent.postMessage({ action: 'GET_CONTEXT_SETTINGS' }, '*');
}

export function saveContextSettingsToStorage(settings) {
    window.parent.postMessage(
        {
            action: 'SAVE_CONTEXT_SETTINGS',
            payload: settings,
        },
        '*'
    );
}

export function requestConnectionSettingsFromStorage() {
    window.parent.postMessage({ action: 'GET_CONNECTION_SETTINGS' }, '*');
}

export function saveConnectionSettingsToStorage(connectionSettings) {
    window.parent.postMessage(
        {
            action: 'SAVE_CONNECTION_SETTINGS',
            payload: connectionSettings,
        },
        '*'
    );
}
