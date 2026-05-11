
// ui_sidebar.js -> sandbox/ui/sidebar.js
import { t } from '../core/i18n.js';

export class SidebarController {
    constructor(elements, callbacks) {
        this.sidebar = elements.sidebar;
        this.overlay = elements.sidebarOverlay;
        this.listEl = elements.historyListEl;
        this.toggleBtn = elements.historyToggleBtn;
        this.closeBtn = elements.closeSidebarBtn;
        
        // Search Elements
        this.searchInput = document.getElementById('history-search');
        
        this.callbacks = callbacks || {};

        // State for search
        this.allSessions = [];
        this.currentSessionId = null;
        this.itemCallbacks = null;
        this.renderState = { isGenerating: false, generatingSessionId: null };
        this.fuse = null;
        this.focusTimer = null;

        this.initListeners();
    }

    initListeners() {
        if(this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if(this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if(this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.close();
                if (this.callbacks.onOverlayClick) {
                    this.callbacks.onOverlayClick();
                }
            });
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    }

    toggle() {
        if (!this.sidebar) return;

        const willOpen = !this.sidebar.classList.contains('open');
        this.sidebar.classList.toggle('open', willOpen);
        if (this.overlay) {
            this.overlay.classList.toggle('visible', willOpen);
        }

        this._clearFocusTimer();

        if (willOpen && this.searchInput) {
            this.focusTimer = window.setTimeout(() => {
                this.focusTimer = null;
                this.searchInput.focus({ preventScroll: true });
            }, 220);
        }
    }

    close() {
        this._clearFocusTimer();
        if (this.sidebar) this.sidebar.classList.remove('open');
        if (this.overlay) this.overlay.classList.remove('visible');
    }

    _clearFocusTimer() {
        if (this.focusTimer === null) return;
        window.clearTimeout(this.focusTimer);
        this.focusTimer = null;
    }

    _initSearch() {
        if (this.fuse) return;
        
        if (window.Fuse && this.allSessions && this.allSessions.length > 0) {
             this.fuse = new window.Fuse(this.allSessions, {
                keys: [
                    { name: 'title', weight: 0.7 },
                    { name: 'messages.text', weight: 0.3 }
                ],
                threshold: 0.4,
                ignoreLocation: true
            });
        }
    }

    handleSearch(query) {
        if (!this.allSessions) return;

        let displayList = this.allSessions;

        // Lazy Init Fuse
        this._initSearch();

        if (query.trim() && this.fuse) {
            const results = this.fuse.search(query);
            displayList = results.map(r => r.item);
        }

        this._renderDOM(displayList);
    }

    renderList(sessions, currentId, itemCallbacks, renderState = {}) {
        if (!this.listEl) return;
        
        // Cache data for searching
        this.allSessions = sessions;
        this.currentSessionId = currentId;
        this.itemCallbacks = itemCallbacks;
        this.renderState = {
            isGenerating: renderState.isGenerating === true,
            generatingSessionId: renderState.generatingSessionId || null
        };
        
        // Reset Fuse index as data changed
        this.fuse = null;
        
        // Check if there is an active search query
        const currentQuery = this.searchInput ? this.searchInput.value : '';
        if (currentQuery.trim()) {
            this.handleSearch(currentQuery);
        } else {
            this._renderDOM(this.allSessions);
        }
    }

    _renderDOM(sessions) {
        const fragment = document.createDocumentFragment();
        
        if (sessions.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.padding = '16px';
            emptyEl.style.textAlign = 'center';
            emptyEl.style.color = 'var(--text-tertiary)';
            emptyEl.style.fontSize = '13px';
            emptyEl.textContent = t('noConversations');
            fragment.appendChild(emptyEl);
            this.listEl.replaceChildren(fragment);
            return;
        }

        sessions.forEach(s => {
            const isGeneratingSession = this.renderState.isGenerating
                && this.renderState.generatingSessionId === s.id;
            const item = document.createElement('div');
            item.className = `history-item ${s.id === this.currentSessionId ? 'active' : ''}`;
            item.onclick = () => {
                this.itemCallbacks.onSwitch(s.id);
                // On mobile or small screens, maybe auto-close sidebar?
                // Keeping current behavior: explicit close required or select closes
                if (window.innerWidth < 600) {
                    this.close();
                }
            };
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title';
            titleSpan.textContent = s.title;

            const spinner = document.createElement('span');
            spinner.className = 'history-generating-spinner';
            spinner.title = t('generating');
            spinner.setAttribute('aria-label', t('generating'));
            
            const delBtn = document.createElement('span');
            delBtn.className = 'history-delete';
            delBtn.textContent = '✕';
            delBtn.title = t('delete');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm(t('deleteChatConfirm'))) {
                    this.itemCallbacks.onDelete(s.id);
                }
            };

            item.appendChild(titleSpan);
            if (isGeneratingSession) {
                item.appendChild(spinner);
            }
            item.appendChild(delBtn);
            fragment.appendChild(item);
        });

        this.listEl.replaceChildren(fragment);
    }
}
