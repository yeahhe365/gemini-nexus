import { describe, expect, it } from 'vitest';

import { collectI18nKeysFromSource, readProjectFile } from './project-structure/helpers.js';

describe('project i18n', () => {
    it('keeps i18n dictionaries free of untranslated orphan keys', async () => {
        const runtimeFiles = [
            'sandbox/controllers/session_flow.js',
            'sandbox/controllers/app_controller.js',
            'sandbox/controllers/prompt.js',
            'sandbox/controllers/message_handler.js',
            'sandbox/controllers/message_results.js',
            'sandbox/render/artifacts.js',
            'sandbox/render/content.js',
            'sandbox/render/sources.js',
            'sandbox/render/config.js',
            'sandbox/render/copy_button.js',
            'sandbox/render/message_edit.js',
            'sandbox/render/message.js',
            'sandbox/render/thoughts_block.js',
            'sandbox/render/generated_image.js',
            'sandbox/boot/app.js',
            'sandbox/boot/renderer.js',
            'sandbox/boot/events.js',
            'sandbox/boot/tool_button_events.js',
            'sandbox/ui/chat.js',
            'sandbox/ui/model_options.js',
            'sandbox/ui/sidebar.js',
            'sandbox/ui/tab_selector.js',
            'sandbox/ui/web_thinking_toggle.js',
            'sandbox/ui/settings/index.js',
            'sandbox/ui/settings/sections/connection_events.js',
            'sandbox/ui/settings/sections/connection.js',
            'sandbox/ui/settings/sections/general.js',
            'sandbox/ui/settings/sections/mcp_tools_view.js',
            'sandbox/ui/templates/footer.js',
            'sandbox/ui/templates/header.js',
            'sandbox/ui/templates/chat.js',
            'sandbox/ui/templates/sidebar.js',
            'sandbox/ui/templates/tab_selector.js',
            'sandbox/ui/templates/viewer.js',
            'sandbox/ui/templates/settings/about.js',
            'sandbox/ui/templates/settings/appearance.js',
            'sandbox/ui/templates/settings/connection.js',
            'sandbox/ui/templates/settings/general.js',
            'sandbox/ui/templates/settings/help_button.js',
            'sandbox/ui/templates/settings/index.js',
            'sandbox/ui/templates/settings/shortcuts.js',
        ];
        const i18n = await readProjectFile('sandbox/core/translations.js');
        const usedKeys = new Set();

        for (const runtimeFile of runtimeFiles) {
            const source = await readProjectFile(runtimeFile);
            for (const key of collectI18nKeysFromSource(source)) {
                usedKeys.add(key);
            }
        }

        for (const match of i18n.matchAll(/^\s{8}([A-Za-z][A-Za-z0-9_]*):/gm)) {
            expect(usedKeys.has(match[1]), match[1]).toBe(true);
        }
    });
});
