import {
    createWebModelOptionMarkup,
    createWebModelOptions,
} from '../../../shared/models/web_models.js';
import { TemplateIcons } from './icons.js';

const defaultModelLabel = createWebModelOptions()[0]?.label || '';

export const HeaderTemplate = `
    <!-- HEADER -->
    <div class="header">
        <div class="header-left">
            <button id="history-toggle" class="icon-btn" data-i18n-title="toggleHistory" title="Chat History">
                ${TemplateIcons.SIDEBAR_TOGGLE}
            </button>

            <div class="model-select-wrapper">
                <select id="model-select" class="model-native-select" data-i18n-title="modelSelectTooltip" title="Select Model (Tab to cycle)" aria-hidden="true" tabindex="-1">
                    ${createWebModelOptionMarkup()}
                </select>
                <button id="model-picker-trigger" class="model-picker-trigger" type="button" data-i18n-title="modelSelectTooltip" title="Select Model (Tab to cycle)" aria-haspopup="listbox" aria-expanded="false" aria-controls="model-picker-listbox">
                    <span class="model-picker-current">${defaultModelLabel}</span>
                </button>
                <button id="web-thinking-toggle" class="web-thinking-toggle" type="button" hidden data-i18n-title="headerThinkingToggleAria" title="Toggle thinking level" aria-label="Toggle thinking level" aria-pressed="false">
                    ${TemplateIcons.ZAP}
                </button>
                <div id="model-picker-menu" class="model-picker-menu" hidden>
                    <div id="model-picker-listbox" class="model-picker-listbox" role="listbox"></div>
                </div>
            </div>
        </div>

        <div class="header-right">
            <button id="tab-switcher-btn" class="icon-btn" hidden data-i18n-title="selectTabTooltip" title="Select a tab to control">
                ${TemplateIcons.TAB_STACK}
            </button>
            <button id="open-full-page-btn" class="icon-btn" data-i18n-title="openFullPageTooltip" title="Open in Full Page">
                ${TemplateIcons.EXTERNAL_OPEN}
            </button>
            <button id="new-chat-header-btn" class="icon-btn" data-i18n-title="newChatTooltip" title="New Chat">
                ${TemplateIcons.NEW_CHAT}
            </button>
        </div>
    </div>
`;
