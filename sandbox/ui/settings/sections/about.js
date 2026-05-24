import { t } from '../../../core/i18n.js';
import { DOM_IDS } from '../constants.js';
import { getSettingsElement } from '../dom.js';

export class AboutSection {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        this.elements = {
            btnDownloadLogs: getSettingsElement(DOM_IDS.DOWNLOAD_LOGS),
            btnExportHistory: getSettingsElement(DOM_IDS.EXPORT_HISTORY_DATA),
            btnImportHistory: getSettingsElement(DOM_IDS.IMPORT_HISTORY_DATA),
            inputImportHistory: getSettingsElement(DOM_IDS.IMPORT_HISTORY_FILE),
            btnExportSettings: getSettingsElement(DOM_IDS.EXPORT_SETTINGS_DATA),
            btnImportSettings: getSettingsElement(DOM_IDS.IMPORT_SETTINGS_DATA),
            inputImportSettings: getSettingsElement(DOM_IDS.IMPORT_SETTINGS_FILE),
            aboutGroup: getSettingsElement(DOM_IDS.ABOUT_GROUP),
            starEl: getSettingsElement(DOM_IDS.STAR_COUNT),
            currentVersionEl: getSettingsElement(DOM_IDS.APP_CURRENT_VERSION),
            updateStatusEl: getSettingsElement(DOM_IDS.APP_UPDATE_STATUS),
        };
    }

    bindEvents() {
        if (this.elements.btnDownloadLogs) {
            this.elements.btnDownloadLogs.addEventListener('click', () => {
                if (this.callbacks.onDownloadLogs) this.callbacks.onDownloadLogs();
            });
        }
        if (this.elements.btnExportHistory) {
            this.elements.btnExportHistory.addEventListener('click', () => {
                if (this.callbacks.onExportHistory) this.callbacks.onExportHistory();
            });
        }
        if (this.elements.btnImportHistory && this.elements.inputImportHistory) {
            this.elements.btnImportHistory.addEventListener('click', () => {
                this.elements.inputImportHistory.click();
            });
            this.elements.inputImportHistory.addEventListener('change', () => {
                this.importJsonFile(this.elements.inputImportHistory, (payload) => {
                    if (this.callbacks.onImportHistory) this.callbacks.onImportHistory(payload);
                });
            });
        }
        if (this.elements.btnExportSettings) {
            this.elements.btnExportSettings.addEventListener('click', () => {
                if (this.callbacks.onExportSettings) this.callbacks.onExportSettings();
            });
        }
        if (this.elements.btnImportSettings && this.elements.inputImportSettings) {
            this.elements.btnImportSettings.addEventListener('click', () => {
                this.elements.inputImportSettings.click();
            });
            this.elements.inputImportSettings.addEventListener('change', () => {
                this.importJsonFile(this.elements.inputImportSettings, (payload) => {
                    if (this.callbacks.onImportSettings) this.callbacks.onImportSettings(payload);
                });
            });
        }
        document.addEventListener('click', (event) => {
            const link = event.target.closest('#about-settings-group a[href]');
            if (!link) return;

            if (this.elements.aboutGroup && !this.elements.aboutGroup.contains(link)) return;

            const href = link.getAttribute('href');
            if (!href || !/^https?:\/\//i.test(href)) return;

            event.preventDefault();
            event.stopPropagation();
            window.parent.postMessage(
                {
                    action: 'OPEN_EXTERNAL_URL',
                    payload: { url: href },
                },
                '*'
            );
        });
    }

    importJsonFile(input, onLoaded) {
        const file = input?.files?.[0];
        if (!file) return;

        const resetInput = () => {
            input.value = '';
        };
        const fail = () => {
            alert(t('dataImportFailed'));
            resetInput();
        };

        try {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const payload = JSON.parse(String(reader.result || ''));
                    onLoaded(payload);
                    resetInput();
                } catch {
                    fail();
                }
            };
            reader.onerror = fail;
            reader.readAsText(file);
        } catch {
            fail();
        }
    }

    displayStars(count) {
        const { starEl } = this.elements;
        if (!starEl) return;

        if (count) {
            const formatted = count > 999 ? (count / 1000).toFixed(1) + 'k' : count;
            starEl.textContent = `★ ${formatted}`;
            starEl.classList.add('is-visible');
            starEl.dataset.fetched = 'true';
        } else {
            starEl.classList.remove('is-visible');
        }
    }

    hasFetchedStars() {
        return this.elements.starEl && this.elements.starEl.dataset.fetched === 'true';
    }

    setCurrentVersion(version) {
        if (this.elements.currentVersionEl) {
            this.elements.currentVersionEl.textContent = version || '';
        }
    }

    getCurrentVersion() {
        return this.elements.currentVersionEl ? this.elements.currentVersionEl.textContent : null;
    }

    displayUpdateStatus(latest, current, isUpdateAvailable) {
        const { updateStatusEl } = this.elements;
        if (!updateStatusEl) return;

        updateStatusEl.replaceChildren();
        updateStatusEl.classList.remove('is-muted');

        if (isUpdateAvailable) {
            const link = document.createElement('a');
            link.href = 'https://github.com/yeahhe365/Gemini-Nexus/releases';
            link.target = '_blank';
            link.className = 'app-update-link';
            link.textContent = `Update available: ${latest}`;
            updateStatusEl.appendChild(link);
        } else {
            updateStatusEl.textContent = `(Latest: ${latest})`;
            updateStatusEl.classList.add('is-muted');
        }
    }
}
