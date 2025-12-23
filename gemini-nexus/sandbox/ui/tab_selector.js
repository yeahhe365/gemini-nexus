
// sandbox/ui/tab_selector.js
import { t } from '../core/i18n.js';

export class TabSelectorController {
    constructor() {
        this.modal = null;
        this.listEl = null;
        this.btnClose = null;
        this.triggerBtn = null;
        this.onSelect = null;
        this.currentLockedId = null;

        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        this.modal = document.getElementById('tab-selector-modal');
        this.listEl = document.getElementById('tab-list');
        this.btnClose = document.getElementById('close-tab-selector');
        this.triggerBtn = document.getElementById('tab-switcher-btn');
    }

    bindEvents() {
        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
    }

    open(tabs, onSelectCallback, lockedTabId) {
        this.onSelect = onSelectCallback;
        this.currentLockedId = lockedTabId;
        this.renderList(tabs);
        if (this.modal) this.modal.classList.add('visible');
    }

    close() {
        if (this.modal) this.modal.classList.remove('visible');
    }

    renderList(tabs) {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (!tabs || tabs.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.padding = '16px';
            emptyEl.style.textAlign = 'center';
            emptyEl.style.color = 'var(--text-tertiary)';
            emptyEl.style.fontSize = '13px';
            emptyEl.textContent = t('noTabsFound');
            this.listEl.appendChild(emptyEl);
            return;
        }

        tabs.forEach(tab => {
            // Is this tab the "Locked" one?
            const isLocked = tab.id === this.currentLockedId;
            
            const item = document.createElement('div');
            // 'active' in CSS usually denotes selection, here we use it for locked state visibility
            item.className = `history-item ${isLocked ? 'active' : ''}`;
            
            // Tab Icon/Favicon
            const icon = document.createElement('img');
            icon.src = tab.favIconUrl || ''; 
            icon.style.width = '16px';
            icon.style.height = '16px';
            icon.style.marginRight = '8px';
            icon.style.borderRadius = '2px';
            icon.onerror = () => { icon.style.display = 'none'; };

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title';
            titleSpan.textContent = tab.title || tab.url;
            
            // Lock Button (Toggle State)
            const lockBtn = document.createElement('div');
            
            // Icons
            const CLOSED_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
            const OPEN_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

            if (isLocked) {
                lockBtn.innerHTML = CLOSED_LOCK;
                lockBtn.title = t('unlockTab');
                lockBtn.style.color = 'var(--primary)';
            } else {
                lockBtn.innerHTML = OPEN_LOCK;
                lockBtn.title = t('lockTab');
                lockBtn.style.color = 'var(--text-tertiary)';
            }
            
            Object.assign(lockBtn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                marginLeft: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: '0'
            });

            lockBtn.onmouseenter = () => {
                lockBtn.style.background = 'var(--btn-hover)';
            };
            lockBtn.onmouseleave = () => {
                lockBtn.style.background = 'transparent';
            };

            // --- Separate Handlers ---

            // 1. Lock Button Click: Only Lock/Unlock, NO Switch
            lockBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent bubbling to item click
                
                let nextActionId = tab.id;
                if (isLocked) {
                    nextActionId = null; // Unlock
                    this.resetTrigger();
                } else {
                    this.updateTrigger(tab); // Lock
                }
                
                // Pass false to indicate we do NOT want to switch visual tab
                if (this.onSelect) this.onSelect(nextActionId, false);
                this.close();
            };

            // 2. Row Click: Switch + Lock
            item.onclick = (e) => {
                // If we click the row, we generally want to switch to that tab.
                // We also ensure it becomes the locked target for control.
                
                if (!isLocked) {
                    this.updateTrigger(tab);
                }
                
                // Pass true to switch tab
                if (this.onSelect) this.onSelect(tab.id, true);
                this.close();
            };

            item.appendChild(icon);
            item.appendChild(titleSpan);
            item.appendChild(lockBtn);

            this.listEl.appendChild(item);
        });
    }

    updateTrigger(tab) {
        if (!this.triggerBtn) return;
        
        // Remove existing content
        this.triggerBtn.innerHTML = '';
        
        if (tab && tab.favIconUrl) {
            const img = document.createElement('img');
            img.src = tab.favIconUrl;
            img.style.width = '20px';
            img.style.height = '20px';
            img.style.borderRadius = '2px';
            img.style.objectFit = 'contain';
            
            // Fallback to default icon if image fails to load
            img.onerror = () => { this.resetTrigger(); };
            
            this.triggerBtn.appendChild(img);
            this.triggerBtn.title = `Locked: ${tab.title}`;
            // Optional: Add a small lock indicator overlay on the trigger button
            this.triggerBtn.style.border = '1px solid var(--primary)';
        } else {
            this.resetTrigger();
        }
    }

    resetTrigger() {
        if (!this.triggerBtn) return;
        this.triggerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 6h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
            <path d="M2 6l2.5-3.5A2 2 0 0 1 6.1 1h11.8a2 2 0 0 1 1.6 1.5L22 6"/>
        </svg>`;
        this.triggerBtn.title = t('selectTabTooltip') || "Select a tab to control";
        this.triggerBtn.style.border = 'none';
    }
}