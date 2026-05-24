import { t } from '../core/i18n.js';
import { TemplateIcons } from './templates/icons.js';
import {
    requestSidebarExpandedFromStorage,
    saveSidebarExpandedToStorage,
} from '../../shared/messaging/index.js';

function readInitialSidebarExpandedFromUrl(locationLike = window.location) {
    try {
        const url = new URL(locationLike.href);
        const value = url.searchParams.get('sidebarExpanded');
        if (value === 'true') return true;
        if (value === 'false') return false;
    } catch {
        return null;
    }

    return null;
}

const COLLAPSED_RECENT_PANEL_WIDTH = 320;
const COLLAPSED_RECENT_PANEL_MARGIN = 16;

function getSidebarLanguage() {
    return document.documentElement.lang?.startsWith('zh') ? 'zh' : 'en';
}

function getValidSessionDate(session) {
    const timestamp = Number(session?.timestamp);
    const date = new Date(Number.isFinite(timestamp) ? timestamp : 0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function categorizeSessionsByDate(sessions, now = new Date()) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);
    const sevenDaysAgoStart = new Date(todayStart);
    sevenDaysAgoStart.setDate(todayStart.getDate() - 8);
    const thirtyDaysAgoStart = new Date(todayStart);
    thirtyDaysAgoStart.setDate(todayStart.getDate() - 30);

    const categoryLabels = {
        today: t('historyToday'),
        yesterday: t('historyYesterday'),
        sevenDays: t('historyPrevious7Days'),
        thirtyDays: t('historyPrevious30Days'),
    };
    const staticOrder = [
        categoryLabels.today,
        categoryLabels.yesterday,
        categoryLabels.sevenDays,
        categoryLabels.thirtyDays,
    ];
    const categories = new Map();
    const language = getSidebarLanguage();
    const monthFormatter = new Intl.DateTimeFormat(
        language === 'zh' ? 'zh-CN-u-nu-hanidec' : 'en-US',
        {
            year: 'numeric',
            month: 'long',
        }
    );

    sessions.forEach((session) => {
        const sessionDate = getValidSessionDate(session);
        let categoryName = '';

        if (sessionDate >= todayStart) {
            categoryName = categoryLabels.today;
        } else if (sessionDate >= yesterdayStart) {
            categoryName = categoryLabels.yesterday;
        } else if (sessionDate >= sevenDaysAgoStart) {
            categoryName = categoryLabels.sevenDays;
        } else if (sessionDate >= thirtyDaysAgoStart) {
            categoryName = categoryLabels.thirtyDays;
        } else {
            categoryName = monthFormatter.format(sessionDate);
        }

        if (!categories.has(categoryName)) {
            categories.set(categoryName, []);
        }
        categories.get(categoryName).push(session);
    });

    const monthCategories = [...categories.keys()]
        .filter((categoryName) => !staticOrder.includes(categoryName))
        .sort(
            (leftCategory, rightCategory) =>
                getValidSessionDate(categories.get(rightCategory)?.[0]).getTime() -
                getValidSessionDate(categories.get(leftCategory)?.[0]).getTime()
        );

    const categoryOrder = [...staticOrder, ...monthCategories].filter(
        (categoryName) => (categories.get(categoryName) || []).length > 0
    );

    return { categories, categoryOrder };
}

export class SidebarController {
    constructor(elements, callbacks) {
        this.sidebar = elements.sidebar;
        this.overlay = elements.sidebarOverlay;
        this.listEl = elements.historyListEl;
        this.toggleBtn = elements.historyToggleBtn;
        this.closeBtn = elements.closeSidebarBtn;

        this.searchContainer = document.querySelector('.search-container');
        this.searchInput = document.getElementById('history-search');
        this.searchToggleBtn = document.getElementById('sidebar-search-toggle');
        this.searchClearBtn = document.getElementById('history-search-clear');
        this.sidebarHistory = document.querySelector('.sidebar-history');
        this.collapsedRail = document.querySelector('.collapsed-sidebar-rail');
        this.collapsedToggleBtn = document.getElementById('collapsed-sidebar-toggle');
        this.collapsedSearchBtn = document.getElementById('collapsed-search-btn');
        this.collapsedRecentBtn = document.getElementById('collapsed-recent-chats-btn');
        this.collapsedRecentPopover = document.getElementById('collapsed-recent-popover');

        this.callbacks = callbacks || {};

        this.allSessions = [];
        this.allGroups = [];
        this.currentSessionId = null;
        this.itemCallbacks = null;
        this.renderState = { isGenerating: false, generatingSessionId: null };
        this.searchOpen = this.searchContainer ? !this.searchContainer.hidden : false;
        this.activeMenuId = null;
        this.activeMenuType = null;
        this.editingSessionId = null;
        this.editingSessionTitle = '';
        this.editingGroupId = null;
        this.editingGroupTitle = '';
        this.dragOverGroupId = null;
        this.isCollapsedRecentOpen = false;
        this.collapsedRecentPinned = false;
        this.collapsedRecentCloseTimer = null;
        this.restoredSidebarExpanded = readInitialSidebarExpandedFromUrl();

        this.portalCollapsedRecentPopover();
        this.initListeners();
        this.restorePersistedWideSidebarState();
        requestSidebarExpandedFromStorage();
    }

    portalCollapsedRecentPopover() {
        if (
            !this.collapsedRecentPopover ||
            this.collapsedRecentPopover.parentElement === document.body
        ) {
            return;
        }

        document.body.appendChild(this.collapsedRecentPopover);
    }

    initListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.toggle());
        }
        if (this.collapsedToggleBtn) {
            this.collapsedToggleBtn.addEventListener('click', () => this.toggle());
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.close();
                if (this.callbacks.onOverlayClick) {
                    this.callbacks.onOverlayClick();
                }
            });
        }
        if (this.sidebarHistory) {
            this.sidebarHistory.addEventListener('click', (clickEvent) =>
                this.handleExpandedEmptySpaceClick(clickEvent)
            );
        }
        if (this.collapsedRail) {
            this.collapsedRail.addEventListener('click', (clickEvent) =>
                this.handleCollapsedRailEmptySpaceClick(clickEvent)
            );
        }
        if (this.searchToggleBtn) {
            this.searchToggleBtn.addEventListener('click', () => this.openSearch());
        }
        if (this.collapsedSearchBtn) {
            this.collapsedSearchBtn.addEventListener('click', () => this.openSearch());
        }
        if (this.collapsedRecentBtn) {
            this.collapsedRecentBtn.addEventListener('click', (clickEvent) => {
                clickEvent.stopPropagation();
                this.toggleCollapsedRecentPopover();
            });
            this.collapsedRecentBtn.addEventListener('mouseenter', () =>
                this.openCollapsedRecentPopover()
            );
            this.collapsedRecentBtn.addEventListener('mouseleave', () =>
                this.scheduleCollapsedRecentClose()
            );
            this.collapsedRecentBtn.addEventListener('focus', () =>
                this.openCollapsedRecentPopover()
            );
            this.collapsedRecentBtn.addEventListener('blur', () =>
                this.scheduleCollapsedRecentClose()
            );
        }
        if (this.collapsedRecentPopover) {
            this.collapsedRecentPopover.addEventListener('mouseenter', () =>
                this.clearCollapsedRecentCloseTimer()
            );
            this.collapsedRecentPopover.addEventListener('mouseleave', () =>
                this.scheduleCollapsedRecentClose()
            );
        }
        if (this.searchClearBtn) {
            this.searchClearBtn.addEventListener('click', () => this.clearSearch());
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (inputEvent) =>
                this.handleSearch(inputEvent.target.value)
            );
            this.searchInput.addEventListener('keydown', (keyboardEvent) => {
                if (keyboardEvent.key !== 'Escape') return;

                if (this.searchInput.value.trim()) {
                    this.clearSearch();
                } else {
                    this.closeSearch();
                }
            });
        }

        document.addEventListener('click', (clickEvent) => this.handleDocumentClick(clickEvent));
        document.addEventListener('keydown', (keyboardEvent) =>
            this.handleDocumentKeydown(keyboardEvent)
        );
        window.addEventListener('resize', () => this.positionCollapsedRecentPopover());
        window.addEventListener('scroll', () => this.positionCollapsedRecentPopover(), true);
    }

    _isWideLayout() {
        return document.body.classList.contains('layout-wide');
    }

    handleExpandedEmptySpaceClick(clickEvent) {
        const target = clickEvent.target;
        const clickedHistoryShell = target === clickEvent.currentTarget;
        const clickedHistoryListBlank = target === this.listEl;

        if (!clickedHistoryShell && !clickedHistoryListBlank) return;

        this.toggle();
    }

    handleCollapsedRailEmptySpaceClick(clickEvent) {
        const target = clickEvent.target;
        const clickedRailShell = target === clickEvent.currentTarget;
        const clickedRailBlankChild =
            target instanceof Element &&
            Boolean(target.closest('.collapsed-sidebar-spacer, .collapsed-sidebar-separator'));

        if (!clickedRailShell && !clickedRailBlankChild) return;

        this.toggle();
    }

    handleDocumentClick(clickEvent) {
        const target = clickEvent.target;

        if (
            this.activeMenuId &&
            target instanceof Node &&
            !target.closest?.('.history-item-menu') &&
            !target.closest?.('.history-menu-trigger')
        ) {
            this.closeItemMenu();
        }

        if (
            this.isCollapsedRecentOpen &&
            target instanceof Node &&
            !this.collapsedRecentPopover?.contains(target) &&
            !this.collapsedRecentBtn?.contains(target)
        ) {
            this.closeCollapsedRecentPopover();
        }
    }

    handleDocumentKeydown(keyboardEvent) {
        if (keyboardEvent.key !== 'Escape') return;

        this.closeItemMenu();
        this.closeCollapsedRecentPopover();
    }

    _setMobileSidebarState(isOpen) {
        if (!this.sidebar) return;

        this.sidebar.classList.toggle('open', isOpen);
        document.body.classList.toggle('sidebar-open', isOpen);
        if (this.overlay) {
            this.overlay.classList.toggle('visible', isOpen);
        }

        if (!isOpen) {
            this.closeSearch();
            this.closeItemMenu();
            this.closeCollapsedRecentPopover();
        }
    }

    _setWideSidebarCollapsed(isCollapsed, { persist = true } = {}) {
        if (!this.sidebar) return;

        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        this.sidebar.classList.toggle('collapsed', isCollapsed);
        this.sidebar.classList.toggle('open', !isCollapsed);

        if (persist) {
            this.restoredSidebarExpanded = !isCollapsed;
            saveSidebarExpandedToStorage(!isCollapsed);
        }

        if (isCollapsed) {
            this.closeSearch();
        }

        this.closeItemMenu();
        this.closeCollapsedRecentPopover();
    }

    restoreSidebarExpanded(isExpanded) {
        if (typeof isExpanded !== 'boolean') return;

        this.restoredSidebarExpanded = isExpanded;

        if (!this.sidebar || !this._isWideLayout()) return;

        this._setWideSidebarCollapsed(!isExpanded, { persist: false });
    }

    restorePersistedWideSidebarState() {
        if (this.restoredSidebarExpanded === null) return;

        this.restoreSidebarExpanded(this.restoredSidebarExpanded);
    }

    handleLayoutModeChange(isWide) {
        if (!this.sidebar) return;

        if (isWide) {
            this.restorePersistedWideSidebarState();
            return;
        }

        document.body.classList.remove('sidebar-collapsed');
        this.sidebar.classList.remove('collapsed');
        this._setMobileSidebarState(false);
    }

    toggle() {
        if (!this.sidebar) return;

        if (this._isWideLayout()) {
            const willCollapse = !document.body.classList.contains('sidebar-collapsed');
            this._setWideSidebarCollapsed(willCollapse);
            return;
        }

        const willOpen = !this.sidebar.classList.contains('open');
        this._setMobileSidebarState(willOpen);
    }

    close() {
        if (!this.sidebar) return;

        if (this._isWideLayout()) {
            this._setWideSidebarCollapsed(true);
            return;
        }

        this._setMobileSidebarState(false);
    }

    openSearch() {
        if (!this.searchContainer || !this.searchInput || !this.searchToggleBtn) return;

        this.closeItemMenu();
        this.closeCollapsedRecentPopover();

        if (this._isWideLayout() && document.body.classList.contains('sidebar-collapsed')) {
            this._setWideSidebarCollapsed(false);
        }

        this.searchContainer.hidden = false;
        this.searchToggleBtn.hidden = true;
        this.searchOpen = true;
        document.body.classList.add('sidebar-search-open');
        this.searchInput.focus({ preventScroll: true });
        this.searchInput.select();
    }

    closeSearch({ clearQuery = true } = {}) {
        if (this.searchInput && clearQuery) {
            this.searchInput.value = '';
        }

        if (this.searchContainer) {
            this.searchContainer.hidden = true;
        }
        if (this.searchToggleBtn) {
            this.searchToggleBtn.hidden = false;
        }

        this.searchOpen = false;
        document.body.classList.remove('sidebar-search-open');

        this.closeItemMenu();

        if (clearQuery) {
            this._renderDOM(this.allSessions);
        }
    }

    clearSearch() {
        if (!this.searchInput) return;

        this.searchInput.value = '';
        this.handleSearch('');
        this.searchInput.focus({ preventScroll: true });
    }

    handleSearch(query) {
        if (!this.allSessions) return;

        const normalizedQuery = query.trim().toLowerCase();
        const displayList = normalizedQuery
            ? this.allSessions.filter((session) =>
                  this._sessionMatchesQuery(session, normalizedQuery)
              )
            : this.allSessions;

        this._renderDOM(displayList);
    }

    _sessionMatchesQuery(session, normalizedQuery) {
        const messageTexts = Array.isArray(session.messages)
            ? session.messages.map((message) =>
                  typeof message?.text === 'string' ? message.text : ''
              )
            : [];

        return [session.title || '', ...messageTexts].some((field) =>
            field.toLowerCase().includes(normalizedQuery)
        );
    }

    openItemMenu(sessionId) {
        this.activeMenuId = sessionId;
        this.activeMenuType = 'session';
        this.closeCollapsedRecentPopover();
        this._renderDOM(this._getDisplayedSessions());
    }

    openGroupMenu(groupId) {
        this.activeMenuId = groupId;
        this.activeMenuType = 'group';
        this.closeCollapsedRecentPopover();
        this._renderDOM(this._getDisplayedSessions());
    }

    closeItemMenu() {
        if (!this.activeMenuId) return;

        this.activeMenuId = null;
        this.activeMenuType = null;
        this._renderDOM(this._getDisplayedSessions());
    }

    _getDisplayedSessions() {
        const currentQuery = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
        if (!currentQuery) return this.allSessions;

        return this.allSessions.filter((session) =>
            this._sessionMatchesQuery(session, currentQuery)
        );
    }

    getRecentSessions() {
        return [...(this.allSessions || [])]
            .filter((session) => session.id !== this.currentSessionId)
            .sort(
                (first, second) =>
                    Number(second.isPinned === true) - Number(first.isPinned === true) ||
                    (second.timestamp || 0) - (first.timestamp || 0)
            )
            .slice(0, 8);
    }

    toggleCollapsedRecentPopover() {
        if (this.isCollapsedRecentOpen && this.collapsedRecentPinned) {
            this.closeCollapsedRecentPopover();
            return;
        }

        this.openCollapsedRecentPopover({ pinned: true });
    }

    openCollapsedRecentPopover({ pinned = false } = {}) {
        if (!this.collapsedRecentPopover || !this.collapsedRecentBtn) return;

        this.clearCollapsedRecentCloseTimer();
        this.closeItemMenu();
        this.portalCollapsedRecentPopover();
        this.renderCollapsedRecentPopover();
        if (pinned || !this.isCollapsedRecentOpen) {
            this.collapsedRecentPinned = pinned;
        }
        this.isCollapsedRecentOpen = true;
        this.positionCollapsedRecentPopover();
        this.collapsedRecentPopover.hidden = false;
        this.collapsedRecentBtn.setAttribute('aria-expanded', 'true');
    }

    positionCollapsedRecentPopover() {
        if (
            !this.isCollapsedRecentOpen ||
            !this.collapsedRecentPopover ||
            !this.collapsedRecentBtn
        ) {
            return;
        }

        const buttonRect = this.collapsedRecentBtn.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const panelWidth = Math.min(
            COLLAPSED_RECENT_PANEL_WIDTH,
            Math.max(180, viewportWidth - COLLAPSED_RECENT_PANEL_MARGIN * 2)
        );
        const rightSideLeft = buttonRect.right;
        const fitsRight =
            rightSideLeft + panelWidth <= viewportWidth - COLLAPSED_RECENT_PANEL_MARGIN;
        const left = fitsRight
            ? rightSideLeft
            : Math.max(COLLAPSED_RECENT_PANEL_MARGIN, buttonRect.left - panelWidth);
        const maxTop = Math.max(
            COLLAPSED_RECENT_PANEL_MARGIN,
            viewportHeight - COLLAPSED_RECENT_PANEL_MARGIN * 2
        );
        const top = Math.min(Math.max(COLLAPSED_RECENT_PANEL_MARGIN, buttonRect.top), maxTop);

        Object.assign(this.collapsedRecentPopover.style, {
            position: 'fixed',
            top: `${Math.round(top)}px`,
            left: `${Math.round(left)}px`,
            width: `${Math.round(panelWidth)}px`,
            maxHeight: `calc(100vh - ${Math.round(top + COLLAPSED_RECENT_PANEL_MARGIN)}px)`,
        });
    }

    closeCollapsedRecentPopover() {
        this.clearCollapsedRecentCloseTimer();

        if (!this.collapsedRecentPopover || !this.collapsedRecentBtn) {
            this.isCollapsedRecentOpen = false;
            this.collapsedRecentPinned = false;
            return;
        }

        this.collapsedRecentPopover.hidden = true;
        this.collapsedRecentBtn.setAttribute('aria-expanded', 'false');
        this.isCollapsedRecentOpen = false;
        this.collapsedRecentPinned = false;
    }

    clearCollapsedRecentCloseTimer() {
        if (this.collapsedRecentCloseTimer === null) return;

        window.clearTimeout(this.collapsedRecentCloseTimer);
        this.collapsedRecentCloseTimer = null;
    }

    scheduleCollapsedRecentClose() {
        if (this.collapsedRecentPinned) return;

        this.clearCollapsedRecentCloseTimer();
        this.collapsedRecentCloseTimer = window.setTimeout(() => {
            this.collapsedRecentCloseTimer = null;
            this.closeCollapsedRecentPopover();
        }, 120);
    }

    renderCollapsedRecentPopover() {
        if (!this.collapsedRecentPopover) return;

        const recentSessions = this.getRecentSessions();
        const fragment = document.createDocumentFragment();

        const title = document.createElement('div');
        title.className = 'collapsed-recent-title';
        title.textContent = t('recentChats');
        fragment.appendChild(title);

        if (recentSessions.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'collapsed-recent-empty';
            emptyState.textContent = t('noConversations');
            fragment.appendChild(emptyState);
            this.collapsedRecentPopover.replaceChildren(fragment);
            return;
        }

        recentSessions.forEach((session) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'collapsed-recent-item';
            item.textContent = session.title;
            item.onclick = () => {
                if (this.itemCallbacks?.onSwitch) {
                    this.itemCallbacks.onSwitch(session.id);
                }
                this.closeCollapsedRecentPopover();
            };
            fragment.appendChild(item);
        });

        this.collapsedRecentPopover.replaceChildren(fragment);
    }

    renderList(
        sessions,
        groupsOrCurrentId,
        currentIdOrCallbacks,
        callbacksOrRenderState,
        renderState = {}
    ) {
        if (!this.listEl) return;

        const hasGroupsArgument = Array.isArray(groupsOrCurrentId);
        const groups = hasGroupsArgument ? groupsOrCurrentId : this.allGroups;
        const currentId = hasGroupsArgument ? currentIdOrCallbacks : groupsOrCurrentId;
        const itemCallbacks = hasGroupsArgument ? callbacksOrRenderState : currentIdOrCallbacks;
        const nextRenderState = hasGroupsArgument ? renderState : callbacksOrRenderState;

        this.allSessions = Array.isArray(sessions) ? sessions : [];
        this.allGroups = Array.isArray(groups) ? groups : [];
        this.currentSessionId = currentId;
        this.itemCallbacks = itemCallbacks || {};
        this.renderState = {
            isGenerating: nextRenderState?.isGenerating === true,
            generatingSessionId: nextRenderState?.generatingSessionId || null,
        };

        if (this.isCollapsedRecentOpen) {
            this.renderCollapsedRecentPopover();
        }

        const currentQuery = this.searchInput ? this.searchInput.value : '';
        if (currentQuery.trim()) {
            this.handleSearch(currentQuery);
        } else {
            this._renderDOM(this.allSessions);
        }
    }

    _renderDOM(sessions) {
        const fragment = document.createDocumentFragment();
        const groups = Array.isArray(this.allGroups) ? this.allGroups : [];

        if (sessions.length === 0 && groups.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-list-state';
            emptyState.textContent = t('noConversations');
            fragment.appendChild(emptyState);
            this.listEl.replaceChildren(fragment);
            return;
        }

        const { groupedSessions, ungroupedSessions } = this.partitionSessionsByGroup(sessions);

        groups.forEach((group) => {
            fragment.appendChild(
                this.createGroupElement(group, groupedSessions.get(group.id) || [])
            );
        });

        const ungroupedContainer = document.createElement('div');
        ungroupedContainer.className = 'history-ungrouped-dropzone';
        this.bindDropTarget(ungroupedContainer, null);

        const pinnedUngroupedSessions = ungroupedSessions.filter(
            (session) => session.isPinned === true
        );
        const unpinnedUngroupedSessions = ungroupedSessions.filter(
            (session) => session.isPinned !== true
        );
        if (pinnedUngroupedSessions.length > 0) {
            ungroupedContainer.appendChild(
                this.createSessionSection(t('pinnedChat'), pinnedUngroupedSessions)
            );
        }

        const { categories, categoryOrder } = categorizeSessionsByDate(unpinnedUngroupedSessions);
        categoryOrder.forEach((categoryName) => {
            ungroupedContainer.appendChild(
                this.createSessionSection(categoryName, categories.get(categoryName) || [])
            );
        });

        fragment.appendChild(ungroupedContainer);

        this.listEl.replaceChildren(fragment);
        this.focusEditingTitleInput();
    }

    partitionSessionsByGroup(sessions) {
        const groupedSessions = new Map();
        const ungroupedSessions = [];

        this.allGroups.forEach((group) => groupedSessions.set(group.id, []));

        sessions.forEach((session) => {
            if (session.groupId && groupedSessions.has(session.groupId)) {
                groupedSessions.get(session.groupId).push(session);
                return;
            }
            ungroupedSessions.push(session);
        });

        return { groupedSessions, ungroupedSessions };
    }

    createSessionSection(title, sessions) {
        const section = document.createElement('section');
        section.className = 'history-session-section';

        const heading = document.createElement('div');
        heading.className = 'history-session-section-title';
        heading.textContent = title;
        section.appendChild(heading);

        sessions.forEach((session) => section.appendChild(this.createSessionRow(session)));
        return section;
    }

    createGroupElement(group, sessions) {
        const isMenuOpen = this.activeMenuType === 'group' && this.activeMenuId === group.id;
        const groupElement = document.createElement('div');
        groupElement.className = ['history-group', isMenuOpen ? 'menu-open' : '']
            .filter(Boolean)
            .join(' ');
        this.bindDropTarget(groupElement, group.id);

        const details = document.createElement('details');
        details.className = 'history-group-details';
        details.open = group.isExpanded !== false;

        const summary = document.createElement('summary');
        summary.className = 'history-group-summary';
        summary.onclick = (clickEvent) => {
            clickEvent.preventDefault();
            if (this.itemCallbacks?.onToggleGroupExpansion) {
                this.itemCallbacks.onToggleGroupExpansion(group.id);
            }
        };

        const titleWrap = document.createElement('div');
        titleWrap.className = 'history-group-title-wrap';

        const chevron = document.createElement('span');
        chevron.className = 'history-group-chevron';
        chevron.innerHTML = TemplateIcons.CHEVRON_DOWN;
        titleWrap.appendChild(chevron);

        if (this.editingGroupId === group.id) {
            titleWrap.appendChild(this.createGroupTitleEditor(group));
        } else {
            const title = document.createElement('span');
            title.className = 'history-group-title';
            title.textContent = group.title;
            titleWrap.appendChild(title);
        }

        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'history-menu-trigger history-group-menu-trigger';
        menuButton.innerHTML = TemplateIcons.MORE_HORIZONTAL;
        menuButton.title = t('moreOptions');
        menuButton.setAttribute('aria-label', t('moreOptions'));
        menuButton.setAttribute('aria-haspopup', 'menu');
        menuButton.setAttribute('aria-expanded', isMenuOpen ? 'true' : 'false');
        menuButton.onclick = (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            if (isMenuOpen) {
                this.closeItemMenu();
                return;
            }
            this.openGroupMenu(group.id);
        };
        menuButton.onkeydown = (keyboardEvent) => keyboardEvent.stopPropagation();

        summary.appendChild(titleWrap);
        summary.appendChild(menuButton);
        details.appendChild(summary);

        if (isMenuOpen) {
            details.appendChild(this.createGroupItemMenu(group));
        }

        const groupSessions = document.createElement('div');
        groupSessions.className = 'history-group-sessions';
        sessions.forEach((session) => groupSessions.appendChild(this.createSessionRow(session)));
        details.appendChild(groupSessions);

        groupElement.appendChild(details);
        return groupElement;
    }

    createGroupTitleEditor(group) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'history-group-edit-input';
        input.value = this.editingGroupTitle || group.title;
        input.setAttribute('aria-label', t('renameGroup'));
        input.onclick = (clickEvent) => clickEvent.stopPropagation();
        input.oninput = (inputEvent) => {
            this.editingGroupTitle = inputEvent.target.value;
        };
        input.onblur = () => this.confirmGroupTitleEdit();
        input.onkeydown = (keyboardEvent) => {
            keyboardEvent.stopPropagation();
            if (keyboardEvent.key === 'Enter' && !keyboardEvent.isComposing) {
                keyboardEvent.preventDefault();
                this.confirmGroupTitleEdit();
            } else if (keyboardEvent.key === 'Escape') {
                keyboardEvent.preventDefault();
                this.cancelGroupTitleEdit();
            }
        };
        return input;
    }

    focusEditingTitleInput() {
        if (!this.editingGroupId && !this.editingSessionId) return;

        const input = this.listEl.querySelector(
            '.history-group-edit-input, .history-session-edit-input'
        );
        if (!input) return;

        input.focus({ preventScroll: true });
        input.select();
    }

    createSessionTitleEditor(session) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'history-session-edit-input';
        input.value = this.editingSessionTitle || session.title;
        input.setAttribute('aria-label', t('renameChat'));
        input.onclick = (clickEvent) => clickEvent.stopPropagation();
        input.oninput = (inputEvent) => {
            this.editingSessionTitle = inputEvent.target.value;
        };
        input.onblur = () => this.confirmSessionTitleEdit();
        input.onkeydown = (keyboardEvent) => {
            keyboardEvent.stopPropagation();
            if (keyboardEvent.key === 'Enter' && !keyboardEvent.isComposing) {
                keyboardEvent.preventDefault();
                this.confirmSessionTitleEdit();
            } else if (keyboardEvent.key === 'Escape') {
                keyboardEvent.preventDefault();
                this.cancelSessionTitleEdit();
            }
        };
        return input;
    }

    startSessionTitleEdit(session) {
        this.editingSessionId = session.id;
        this.editingSessionTitle = session.title;
        this.activeMenuId = null;
        this.activeMenuType = null;
        this._renderDOM(this._getDisplayedSessions());
    }

    confirmSessionTitleEdit() {
        if (!this.editingSessionId) return;

        const sessionId = this.editingSessionId;
        const title = this.editingSessionTitle.trim();
        this.editingSessionId = null;
        this.editingSessionTitle = '';

        if (title && this.itemCallbacks?.onRename) {
            this.itemCallbacks.onRename(sessionId, title);
            return;
        }

        this._renderDOM(this._getDisplayedSessions());
    }

    cancelSessionTitleEdit() {
        if (!this.editingSessionId) return;

        this.editingSessionId = null;
        this.editingSessionTitle = '';
        this._renderDOM(this._getDisplayedSessions());
    }

    startGroupTitleEdit(group) {
        this.editingGroupId = group.id;
        this.editingGroupTitle = group.title;
        this.activeMenuId = null;
        this.activeMenuType = null;
        this._renderDOM(this._getDisplayedSessions());
    }

    confirmGroupTitleEdit() {
        if (!this.editingGroupId) return;

        const groupId = this.editingGroupId;
        const title = this.editingGroupTitle.trim();
        this.editingGroupId = null;
        this.editingGroupTitle = '';

        if (title && this.itemCallbacks?.onRenameGroup) {
            this.itemCallbacks.onRenameGroup(groupId, title);
            return;
        }

        this._renderDOM(this._getDisplayedSessions());
    }

    cancelGroupTitleEdit() {
        if (!this.editingGroupId) return;

        this.editingGroupId = null;
        this.editingGroupTitle = '';
        this._renderDOM(this._getDisplayedSessions());
    }

    createSessionRow(session) {
        const isGeneratingSession =
            this.renderState.isGenerating && this.renderState.generatingSessionId === session.id;
        const isMenuOpen = this.activeMenuType === 'session' && this.activeMenuId === session.id;
        const sessionRow = document.createElement('div');
        sessionRow.className = [
            'history-item',
            session.id === this.currentSessionId ? 'active' : '',
            isMenuOpen ? 'menu-open' : '',
            session.isPinned === true ? 'pinned' : '',
        ]
            .filter(Boolean)
            .join(' ');
        sessionRow.setAttribute('role', 'button');
        sessionRow.draggable = true;
        sessionRow.tabIndex = 0;

        const handleSelect = () => {
            if (this.itemCallbacks?.onSwitch) {
                this.itemCallbacks.onSwitch(session.id);
            }
            if (window.innerWidth < 600) {
                this.close();
            }
        };

        sessionRow.onclick = handleSelect;
        sessionRow.onkeydown = (keyboardEvent) => {
            if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;

            keyboardEvent.preventDefault();
            handleSelect();
        };
        sessionRow.oncontextmenu = (mouseEvent) => {
            mouseEvent.preventDefault();
            this.openItemMenu(session.id);
        };
        sessionRow.ondragstart = (dragEvent) => {
            dragEvent.stopPropagation();
            dragEvent.dataTransfer?.setData('sessionId', session.id);
            dragEvent.dataTransfer?.setData('text/plain', session.id);
            if (dragEvent.dataTransfer) {
                dragEvent.dataTransfer.effectAllowed = 'move';
            }
            sessionRow.classList.add('dragging');
        };
        sessionRow.ondragend = () => {
            sessionRow.classList.remove('dragging');
            this.clearDragState();
        };

        const titleWrap = document.createElement('div');
        titleWrap.className = 'history-title-wrap';

        if (session.isPinned === true) {
            const pinBadge = document.createElement('span');
            pinBadge.className = 'history-pin-badge';
            pinBadge.title = t('pinnedChat');
            pinBadge.setAttribute('aria-label', t('pinnedChat'));
            pinBadge.innerHTML = TemplateIcons.PIN;
            titleWrap.appendChild(pinBadge);
        }

        if (this.editingSessionId === session.id) {
            titleWrap.appendChild(this.createSessionTitleEditor(session));
        } else {
            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title';
            titleSpan.textContent = session.title;
            titleWrap.appendChild(titleSpan);
        }

        const spinner = document.createElement('span');
        spinner.className = 'history-generating-spinner';
        spinner.title = t('generating');
        spinner.setAttribute('aria-label', t('generating'));

        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'history-menu-trigger';
        menuButton.innerHTML = TemplateIcons.MORE_HORIZONTAL;
        menuButton.title = t('moreOptions');
        menuButton.setAttribute('aria-label', t('moreOptions'));
        menuButton.setAttribute('aria-haspopup', 'menu');
        menuButton.setAttribute('aria-expanded', isMenuOpen ? 'true' : 'false');
        menuButton.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (isMenuOpen) {
                this.closeItemMenu();
                return;
            }
            this.openItemMenu(session.id);
        };
        menuButton.onkeydown = (keyboardEvent) => keyboardEvent.stopPropagation();

        sessionRow.appendChild(titleWrap);
        if (isGeneratingSession) {
            sessionRow.appendChild(spinner);
        }
        sessionRow.appendChild(menuButton);

        if (isMenuOpen) {
            sessionRow.appendChild(this.createHistoryItemMenu(session));
        }

        return sessionRow;
    }

    bindDropTarget(element, groupId) {
        const dragClass = 'drag-over';
        const dragKey = groupId || '__ungrouped__';

        element.ondragover = (dragEvent) => {
            dragEvent.preventDefault();
            dragEvent.stopPropagation();
            if (dragEvent.dataTransfer) {
                dragEvent.dataTransfer.dropEffect = 'move';
            }
        };
        element.ondragenter = (dragEvent) => {
            dragEvent.preventDefault();
            dragEvent.stopPropagation();
            this.dragOverGroupId = dragKey;
            element.classList.add(dragClass);
        };
        element.ondragleave = (dragEvent) => {
            if (element.contains(dragEvent.relatedTarget)) return;
            element.classList.remove(dragClass);
            if (this.dragOverGroupId === dragKey) {
                this.dragOverGroupId = null;
            }
        };
        element.ondrop = (dropEvent) => {
            dropEvent.preventDefault();
            dropEvent.stopPropagation();
            element.classList.remove(dragClass);
            this.dragOverGroupId = null;

            const sessionId =
                dropEvent.dataTransfer?.getData('sessionId') ||
                dropEvent.dataTransfer?.getData('text/plain');
            if (sessionId && this.itemCallbacks?.onMoveSessionToGroup) {
                this.itemCallbacks.onMoveSessionToGroup(sessionId, groupId);
            }
        };
    }

    clearDragState() {
        this.dragOverGroupId = null;
        this.listEl
            ?.querySelectorAll('.drag-over')
            .forEach((element) => element.classList.remove('drag-over'));
    }

    createGroupItemMenu(group) {
        const menu = document.createElement('div');
        menu.className = 'history-item-menu history-group-menu';
        menu.setAttribute('role', 'menu');
        menu.onclick = (clickEvent) => clickEvent.stopPropagation();

        const renameItem = document.createElement('button');
        renameItem.type = 'button';
        renameItem.className = 'history-menu-item';
        renameItem.setAttribute('role', 'menuitem');
        renameItem.innerHTML = `${TemplateIcons.EDIT}<span>${t('renameGroup')}</span>`;
        renameItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            this.startGroupTitleEdit(group);
        };

        const deleteItem = document.createElement('button');
        deleteItem.type = 'button';
        deleteItem.className = 'history-menu-item history-menu-delete';
        deleteItem.setAttribute('role', 'menuitem');
        deleteItem.innerHTML = `${TemplateIcons.TRASH}<span>${t('deleteGroup')}</span>`;
        deleteItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (confirm(t('deleteGroupConfirm')) && this.itemCallbacks?.onDeleteGroup) {
                this.itemCallbacks.onDeleteGroup(group.id);
            }
            this.closeItemMenu();
        };

        menu.appendChild(renameItem);
        menu.appendChild(deleteItem);
        return menu;
    }

    createHistoryItemMenu(session) {
        const menu = document.createElement('div');
        menu.className = 'history-item-menu';
        menu.setAttribute('role', 'menu');
        menu.onclick = (clickEvent) => clickEvent.stopPropagation();

        const renameItem = document.createElement('button');
        renameItem.type = 'button';
        renameItem.className = 'history-menu-item';
        renameItem.setAttribute('role', 'menuitem');
        renameItem.innerHTML = `${TemplateIcons.EDIT}<span>${t('renameChat')}</span>`;
        renameItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            this.startSessionTitleEdit(session);
        };

        const pinItem = document.createElement('button');
        pinItem.type = 'button';
        pinItem.className = 'history-menu-item';
        pinItem.setAttribute('role', 'menuitem');
        pinItem.innerHTML = `${
            session.isPinned === true ? TemplateIcons.PIN_OFF : TemplateIcons.PIN
        }<span>${session.isPinned === true ? t('unpinChat') : t('pinChat')}</span>`;
        pinItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (this.itemCallbacks?.onTogglePin) {
                this.itemCallbacks.onTogglePin(session.id);
            }
            this.closeItemMenu();
        };

        const duplicateItem = document.createElement('button');
        duplicateItem.type = 'button';
        duplicateItem.className = 'history-menu-item';
        duplicateItem.setAttribute('role', 'menuitem');
        duplicateItem.innerHTML = `${TemplateIcons.COPY}<span>${t('duplicateChat')}</span>`;
        duplicateItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (this.itemCallbacks?.onDuplicate) {
                this.itemCallbacks.onDuplicate(session.id);
            }
            this.closeItemMenu();
        };

        const shareItem = document.createElement('button');
        shareItem.type = 'button';
        shareItem.className = 'history-menu-item';
        shareItem.setAttribute('role', 'menuitem');
        shareItem.innerHTML = `${TemplateIcons.SHARE}<span>${t('shareChat')}</span>`;
        shareItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (this.itemCallbacks?.onShare) {
                this.itemCallbacks.onShare(session.id);
            }
            this.closeItemMenu();
        };

        const exportTxtItem = document.createElement('button');
        exportTxtItem.type = 'button';
        exportTxtItem.className = 'history-menu-item';
        exportTxtItem.setAttribute('role', 'menuitem');
        exportTxtItem.innerHTML = `${TemplateIcons.DOWNLOAD}<span>${t('exportChatTxt')}</span>`;
        exportTxtItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (this.itemCallbacks?.onExport) {
                this.itemCallbacks.onExport(session.id, 'txt');
            }
            this.closeItemMenu();
        };

        const exportJsonItem = document.createElement('button');
        exportJsonItem.type = 'button';
        exportJsonItem.className = 'history-menu-item';
        exportJsonItem.setAttribute('role', 'menuitem');
        exportJsonItem.innerHTML = `${TemplateIcons.DOWNLOAD}<span>${t('exportChatJson')}</span>`;
        exportJsonItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (this.itemCallbacks?.onExport) {
                this.itemCallbacks.onExport(session.id, 'json');
            }
            this.closeItemMenu();
        };

        const deleteItem = document.createElement('button');
        deleteItem.type = 'button';
        deleteItem.className = 'history-menu-item history-menu-delete';
        deleteItem.setAttribute('role', 'menuitem');
        deleteItem.innerHTML = `${TemplateIcons.TRASH}<span>${t('delete')}</span>`;
        deleteItem.onclick = (clickEvent) => {
            clickEvent.stopPropagation();
            if (confirm(t('deleteChatConfirm')) && this.itemCallbacks?.onDelete) {
                this.itemCallbacks.onDelete(session.id);
            }
            this.closeItemMenu();
        };

        menu.appendChild(renameItem);
        menu.appendChild(pinItem);
        menu.appendChild(duplicateItem);
        menu.appendChild(shareItem);
        menu.appendChild(exportTxtItem);
        menu.appendChild(exportJsonItem);
        menu.appendChild(deleteItem);
        return menu;
    }
}
