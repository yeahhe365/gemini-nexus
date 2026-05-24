import {
    DEFAULT_CONTEXT_MODE,
    DEFAULT_CONTEXT_RECENT_TURNS,
    DEFAULT_SIDE_PANEL_SCOPE,
} from '../../shared/config/constants.js';
import {
    CONNECTION_STORAGE_KEYS,
    createConnectionSettingsPayload,
} from '../../shared/settings/connection.js';
import { CUSTOM_SELECTION_TOOLS_STORAGE_KEY } from '../../shared/settings/selection_tools.js';

export const CONNECTION_STORAGE_KEY_SET = new Set(CONNECTION_STORAGE_KEYS);

export function createConnectionRestoreMessage(localStorageData) {
    return {
        action: 'RESTORE_CONNECTION_SETTINGS',
        payload: createConnectionSettingsPayload(localStorageData),
    };
}

export function createContextRestorePayload(localStorageData) {
    return {
        mode: localStorageData.geminiContextMode || DEFAULT_CONTEXT_MODE,
        recentTurns: localStorageData.geminiContextRecentTurns || DEFAULT_CONTEXT_RECENT_TURNS,
    };
}

export function createInitialRestoreMessages(localStorageData, { theme, language, appVersion }) {
    const connectionSettings = createConnectionSettingsPayload(localStorageData);

    return {
        beforeTabContext: [
            {
                action: 'RESTORE_CONNECTION_SETTINGS',
                payload: connectionSettings,
            },
            {
                action: 'RESTORE_SIDEBAR_BEHAVIOR',
                payload: localStorageData.geminiSidebarBehavior || 'auto',
            },
            {
                action: 'RESTORE_SIDEBAR_EXPANDED',
                payload: localStorageData.geminiSidebarExpanded !== false,
            },
            {
                action: 'RESTORE_CONTEXT_SETTINGS',
                payload: createContextRestorePayload(localStorageData),
            },
            {
                action: 'RESTORE_SIDE_PANEL_SCOPE',
                payload: localStorageData.geminiSidePanelScope || DEFAULT_SIDE_PANEL_SCOPE,
            },
        ],
        afterTabContext: [
            {
                action: 'RESTORE_GROUPS',
                payload: localStorageData.geminiGroups || [],
            },
            {
                action: 'RESTORE_SESSIONS',
                payload: localStorageData.geminiSessions || [],
            },
            {
                action: 'RESTORE_SHORTCUTS',
                payload: localStorageData.geminiShortcuts || null,
            },
            { action: 'RESTORE_MODEL', payload: connectionSettings.selectedModel },
            {
                action: 'RESTORE_TEXT_SELECTION',
                payload: localStorageData.geminiTextSelectionEnabled !== false,
            },
            {
                action: 'RESTORE_TEXT_SELECTION_BLACKLIST',
                payload: localStorageData.geminiTextSelectionBlacklist || '',
            },
            {
                action: 'RESTORE_IMAGE_TOOLS',
                payload: localStorageData.geminiImageToolsEnabled !== false,
            },
            {
                action: 'RESTORE_ACCOUNT_INDICES',
                payload: localStorageData.geminiAccountIndices || '0',
            },
            {
                action: 'RESTORE_APP_VERSION',
                payload: appVersion,
            },
        ],
        afterPendingActions: [
            { action: 'RESTORE_LANGUAGE', payload: language },
            { action: 'RESTORE_THEME', payload: theme },
        ],
    };
}

export function createLocalStorageRestoreMessages(localStorageData, changedKeys) {
    const hasChanged = (key) => changedKeys.includes(key);
    const messages = [];

    if (hasChanged('geminiShortcuts')) {
        messages.push({
            action: 'RESTORE_SHORTCUTS',
            payload: localStorageData.geminiShortcuts || null,
        });
    }

    if (hasChanged('geminiGroups')) {
        messages.push({
            action: 'RESTORE_GROUPS',
            payload: localStorageData.geminiGroups || [],
        });
    }

    if (hasChanged('geminiSessions')) {
        messages.push({
            action: 'RESTORE_SESSIONS',
            payload: localStorageData.geminiSessions || [],
        });
    }

    if (hasChanged('geminiTheme')) {
        messages.push({
            action: 'RESTORE_THEME',
            payload: localStorageData.geminiTheme || 'system',
        });
    }

    if (hasChanged('geminiLanguage')) {
        messages.push({
            action: 'RESTORE_LANGUAGE',
            payload: localStorageData.geminiLanguage || 'system',
        });
    }

    if (hasChanged('geminiSidebarBehavior')) {
        messages.push({
            action: 'RESTORE_SIDEBAR_BEHAVIOR',
            payload: localStorageData.geminiSidebarBehavior || 'auto',
        });
    }

    if (hasChanged('geminiSidebarExpanded')) {
        messages.push({
            action: 'RESTORE_SIDEBAR_EXPANDED',
            payload: localStorageData.geminiSidebarExpanded !== false,
        });
    }

    if (hasChanged('geminiSidePanelScope')) {
        messages.push({
            action: 'RESTORE_SIDE_PANEL_SCOPE',
            payload: localStorageData.geminiSidePanelScope || DEFAULT_SIDE_PANEL_SCOPE,
        });
    }

    if (hasChanged('geminiContextMode') || hasChanged('geminiContextRecentTurns')) {
        messages.push({
            action: 'RESTORE_CONTEXT_SETTINGS',
            payload: createContextRestorePayload(localStorageData),
        });
    }

    if (hasChanged('geminiTextSelectionEnabled')) {
        messages.push({
            action: 'RESTORE_TEXT_SELECTION',
            payload: localStorageData.geminiTextSelectionEnabled !== false,
        });
    }

    if (hasChanged('geminiTextSelectionBlacklist')) {
        messages.push({
            action: 'RESTORE_TEXT_SELECTION_BLACKLIST',
            payload: localStorageData.geminiTextSelectionBlacklist || '',
        });
    }

    if (hasChanged(CUSTOM_SELECTION_TOOLS_STORAGE_KEY)) {
        messages.push({
            action: 'RESTORE_CUSTOM_SELECTION_TOOLS',
            payload: localStorageData[CUSTOM_SELECTION_TOOLS_STORAGE_KEY] || [],
        });
    }

    if (hasChanged('geminiImageToolsEnabled')) {
        messages.push({
            action: 'RESTORE_IMAGE_TOOLS',
            payload: localStorageData.geminiImageToolsEnabled !== false,
        });
    }

    if (hasChanged('geminiAccountIndices')) {
        messages.push({
            action: 'RESTORE_ACCOUNT_INDICES',
            payload: localStorageData.geminiAccountIndices || '0',
        });
    }

    if (changedKeys.some((key) => CONNECTION_STORAGE_KEY_SET.has(key))) {
        messages.push(createConnectionRestoreMessage(localStorageData));
    }

    return messages;
}
