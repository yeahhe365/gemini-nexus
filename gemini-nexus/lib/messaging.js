
// lib/messaging.js

export function sendToBackground(payload) {
    window.parent.postMessage({
        action: 'FORWARD_TO_BACKGROUND',
        payload: payload
    }, '*');
}

export function saveSessionsToStorage(sessions) {
    window.parent.postMessage({
        action: 'SAVE_SESSIONS',
        payload: sessions
    }, '*');
}

export function saveShortcutsToStorage(shortcuts) {
    window.parent.postMessage({
        action: 'SAVE_SHORTCUTS',
        payload: shortcuts
    }, '*');
}

export function requestThemeFromStorage() {
    window.parent.postMessage({ action: 'GET_THEME' }, '*');
}

export function saveThemeToStorage(theme) {
    window.parent.postMessage({
        action: 'SAVE_THEME',
        payload: theme
    }, '*');
}

export function requestLanguageFromStorage() {
    window.parent.postMessage({ action: 'GET_LANGUAGE' }, '*');
}

export function saveLanguageToStorage(lang) {
    window.parent.postMessage({
        action: 'SAVE_LANGUAGE',
        payload: lang
    }, '*');
}

export function requestTextSelectionFromStorage() {
    window.parent.postMessage({ action: 'GET_TEXT_SELECTION' }, '*');
}

export function saveTextSelectionToStorage(enabled) {
    window.parent.postMessage({
        action: 'SAVE_TEXT_SELECTION',
        payload: enabled
    }, '*');
}

export function requestImageToolsFromStorage() {
    window.parent.postMessage({ action: 'GET_IMAGE_TOOLS' }, '*');
}

export function saveImageToolsToStorage(enabled) {
    window.parent.postMessage({
        action: 'SAVE_IMAGE_TOOLS',
        payload: enabled
    }, '*');
}

export function saveSidebarBehaviorToStorage(behavior) {
    window.parent.postMessage({
        action: 'SAVE_SIDEBAR_BEHAVIOR',
        payload: behavior
    }, '*');
}

export function saveSidePanelScopeToStorage(scope) {
    window.parent.postMessage({
        action: 'SAVE_SIDE_PANEL_SCOPE',
        payload: scope
    }, '*');
}

export function requestAccountIndicesFromStorage() {
    window.parent.postMessage({ action: 'GET_ACCOUNT_INDICES' }, '*');
}

export function saveAccountIndicesToStorage(indices) {
    window.parent.postMessage({
        action: 'SAVE_ACCOUNT_INDICES',
        payload: indices
    }, '*');
}

export function requestContextSettingsFromStorage() {
    window.parent.postMessage({ action: 'GET_CONTEXT_SETTINGS' }, '*');
}

export function saveContextSettingsToStorage(settings) {
    window.parent.postMessage({
        action: 'SAVE_CONTEXT_SETTINGS',
        payload: settings
    }, '*');
}

export function requestConnectionSettingsFromStorage() {
    window.parent.postMessage({ action: 'GET_CONNECTION_SETTINGS' }, '*');
}

export function saveConnectionSettingsToStorage(data) {
    window.parent.postMessage({
        action: 'SAVE_CONNECTION_SETTINGS',
        payload: data
    }, '*');
}
