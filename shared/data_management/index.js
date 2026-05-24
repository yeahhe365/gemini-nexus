import { CONNECTION_STORAGE_KEYS } from '../settings/connection.js';
import { CUSTOM_SELECTION_TOOLS_STORAGE_KEY } from '../settings/selection_tools.js';

export const HISTORY_EXPORT_TYPE = 'GeminiNexus-History';
export const SETTINGS_EXPORT_TYPE = 'GeminiNexus-Settings';
export const DATA_EXPORT_VERSION = 1;

export const HISTORY_STORAGE_KEYS = ['geminiSessions', 'geminiGroups'];

export const SETTINGS_STORAGE_KEYS = [
    'geminiShortcuts',
    'geminiTheme',
    'geminiLanguage',
    'geminiTextSelectionEnabled',
    'geminiTextSelectionBlacklist',
    CUSTOM_SELECTION_TOOLS_STORAGE_KEY,
    'geminiImageToolsEnabled',
    'geminiSidebarBehavior',
    'geminiSidePanelScope',
    'geminiAccountIndices',
    'geminiContextMode',
    'geminiContextRecentTurns',
    'geminiSidebarExpanded',
    'geminiToolbarProvider',
    'geminiToolbarModel',
    'geminiToolbarOpenaiSelectedModel',
    'geminiTranslationTargets',
    'gemini_nexus_window_size',
    ...CONNECTION_STORAGE_KEYS,
];

const SETTINGS_STORAGE_KEY_SET = new Set(SETTINGS_STORAGE_KEYS);
const SECRET_STORAGE_KEYS = new Set(['geminiApiKey', 'geminiOpenaiApiKey']);

function cloneJsonSafe(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export function isSensitiveDataKey(name) {
    const normalized = String(name || '')
        .trim()
        .toLowerCase();
    if (!normalized) return false;

    return (
        normalized === 'authorization' ||
        normalized === 'proxy-authorization' ||
        normalized.includes('token') ||
        normalized.includes('secret') ||
        normalized.includes('api-key') ||
        normalized.includes('apikey') ||
        normalized.includes('password')
    );
}

function redactHeaders(headers) {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};

    return Object.fromEntries(
        Object.entries(headers).filter(([headerName]) => !isSensitiveDataKey(headerName))
    );
}

function redactMcpServers(servers) {
    if (!Array.isArray(servers)) return [];

    return servers.map((server) => {
        const cloned = cloneJsonSafe(server) || {};
        if (cloned.headers) cloned.headers = redactHeaders(cloned.headers);
        if (cloned.env) cloned.env = {};
        if (cloned.auth && typeof cloned.auth === 'object') {
            cloned.auth = { type: cloned.auth.type };
        }
        return cloned;
    });
}

function sanitizeSessionForExport(session) {
    const cloned = cloneJsonSafe(session) || {};
    cloned.context = null;
    return cloned;
}

export function buildHistoryExportPayload(storageData = {}, exportedAt = new Date().toISOString()) {
    return {
        type: HISTORY_EXPORT_TYPE,
        version: DATA_EXPORT_VERSION,
        exportedAt,
        history: Array.isArray(storageData.geminiSessions)
            ? storageData.geminiSessions.map(sanitizeSessionForExport)
            : [],
        groups: Array.isArray(storageData.geminiGroups)
            ? cloneJsonSafe(storageData.geminiGroups)
            : [],
    };
}

function redactSettingValue(key, value) {
    if (key === 'geminiMcpServers') return redactMcpServers(value);
    return cloneJsonSafe(value);
}

export function buildSettingsExportPayload(
    storageData = {},
    exportedAt = new Date().toISOString()
) {
    const settings = {};

    for (const key of SETTINGS_STORAGE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(storageData, key)) continue;
        if (SECRET_STORAGE_KEYS.has(key)) continue;

        settings[key] = redactSettingValue(key, storageData[key]);
    }

    return {
        type: SETTINGS_EXPORT_TYPE,
        version: DATA_EXPORT_VERSION,
        exportedAt,
        settings,
    };
}

export function normalizeHistoryImportPayload(payload) {
    if (!payload || payload.type !== HISTORY_EXPORT_TYPE || !Array.isArray(payload.history)) {
        throw new Error('Invalid Gemini Nexus history import file.');
    }

    return {
        sessions: cloneJsonSafe(payload.history) || [],
        groups: Array.isArray(payload.groups) ? cloneJsonSafe(payload.groups) : [],
    };
}

export function normalizeSettingsImportPayload(payload) {
    if (!payload || payload.type !== SETTINGS_EXPORT_TYPE || !payload.settings) {
        throw new Error('Invalid Gemini Nexus settings import file.');
    }

    const update = {};
    for (const [key, value] of Object.entries(payload.settings)) {
        if (!SETTINGS_STORAGE_KEY_SET.has(key)) continue;
        if (SECRET_STORAGE_KEYS.has(key)) continue;

        update[key] = redactSettingValue(key, value);
    }

    return update;
}

export function mergeImportedRecords(existingRecords, importedRecords) {
    const existing = Array.isArray(existingRecords) ? existingRecords : [];
    const imported = Array.isArray(importedRecords) ? importedRecords : [];
    const existingIds = new Set(existing.map((record) => record?.id).filter(Boolean));
    const additions = imported.filter((record) => record?.id && !existingIds.has(record.id));

    return [...existing, ...additions];
}

export function buildHistoryImportStorageUpdate(payload, currentStorageData = {}) {
    const { sessions, groups } = normalizeHistoryImportPayload(payload);
    const deletedSessionIds =
        currentStorageData.geminiDeletedSessionIds &&
        typeof currentStorageData.geminiDeletedSessionIds === 'object'
            ? { ...currentStorageData.geminiDeletedSessionIds }
            : {};

    sessions.forEach((session) => {
        if (session?.id) delete deletedSessionIds[session.id];
    });

    return {
        geminiSessions: mergeImportedRecords(currentStorageData.geminiSessions, sessions),
        geminiGroups: mergeImportedRecords(currentStorageData.geminiGroups, groups),
        geminiDeletedSessionIds: deletedSessionIds,
    };
}

export function buildSettingsImportStorageUpdate(payload) {
    return normalizeSettingsImportPayload(payload);
}

export function buildDataExportFilename(kind, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10);
    return `gemini-nexus-${kind}-${stamp}.json`;
}
