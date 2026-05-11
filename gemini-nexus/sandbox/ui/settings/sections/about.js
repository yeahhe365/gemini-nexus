
// sandbox/ui/settings/sections/about.js

export class AboutSection {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            btnDownloadLogs: get('download-logs'),
            aboutGroup: get('about-settings-group'),
            starEl: get('star-count'),
            currentVersionEl: get('app-current-version'),
            updateStatusEl: get('app-update-status')
        };
    }

    bindEvents() {
        if (this.elements.btnDownloadLogs) {
            this.elements.btnDownloadLogs.addEventListener('click', () => {
                if (this.callbacks.onDownloadLogs) this.callbacks.onDownloadLogs();
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
            window.parent.postMessage({
                action: 'OPEN_EXTERNAL_URL',
                payload: { url: href }
            }, '*');
        });
    }

    displayStars(count) {
        const { starEl } = this.elements;
        if (!starEl) return;
        
        if (count) {
            const formatted = count > 999 ? (count/1000).toFixed(1) + 'k' : count;
            starEl.textContent = `★ ${formatted}`;
            starEl.style.display = 'inline-flex';
            starEl.dataset.fetched = "true";
        } else {
            starEl.style.display = 'none';
        }
    }

    hasFetchedStars() {
        return this.elements.starEl && this.elements.starEl.dataset.fetched === "true";
    }

    setCurrentVersion(version) {
        if (this.elements.currentVersionEl) {
            this.elements.currentVersionEl.textContent = version || "";
        }
    }

    getCurrentVersion() {
        return this.elements.currentVersionEl ? this.elements.currentVersionEl.textContent : null;
    }

    displayUpdateStatus(latest, current, isUpdateAvailable) {
        const { updateStatusEl } = this.elements;
        if (!updateStatusEl) return;

        if (isUpdateAvailable) {
            updateStatusEl.innerHTML = `<a href="https://github.com/Maomaoxion/gemini-nexus/releases" target="_blank" style="color: #d93025; text-decoration: none; border-bottom: 1px dashed;">Update available: ${latest}</a>`;
        } else {
            updateStatusEl.textContent = `(Latest: ${latest})`;
            updateStatusEl.style.color = "var(--text-tertiary)";
        }
    }
}
