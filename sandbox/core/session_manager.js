import { generateUUID } from '../../shared/utils/index.js';
import {
    getImageAttachmentDataUrls,
    normalizeUserAttachments,
} from '../../shared/attachments/index.js';

export class SessionManager {
    constructor() {
        this.sessions = [];
        this.groups = [];
        this.currentSessionId = null;
    }

    createSession() {
        const newId = generateUUID();
        const newSession = {
            id: newId,
            title: 'New Chat',
            timestamp: Date.now(),
            messages: [],
            context: null, // Gemini context IDs
        };
        this.sessions.unshift(newSession);
        this.currentSessionId = newId;
        return newSession;
    }

    setSessions(sessions) {
        this.sessions = this.filterPersistableSessions(sessions || []);
        if (this.currentSessionId && !this.getSessionById(this.currentSessionId)) {
            this.currentSessionId = null;
        }
    }

    setGroups(groups) {
        this.groups = this.normalizeGroups(groups);
    }

    getCurrentSession() {
        return this.getSessionById(this.currentSessionId);
    }

    getSortedSessions() {
        return this.getPersistableSessions().sort(
            (leftSession, rightSession) =>
                Number(rightSession.isPinned === true) - Number(leftSession.isPinned === true) ||
                (rightSession.timestamp || 0) - (leftSession.timestamp || 0)
        );
    }

    getSortedGroups() {
        return this.getPersistableGroups().sort(
            (leftGroup, rightGroup) => rightGroup.timestamp - leftGroup.timestamp
        );
    }

    setCurrentId(id) {
        this.currentSessionId = this.getSessionById(id) ? id : null;
    }

    enterDraft() {
        this.currentSessionId = null;
    }

    getSessionById(id) {
        if (!id) return null;
        return this.sessions.find((session) => session.id === id) || null;
    }

    getPersistableSessions() {
        return this.filterPersistableSessions(this.sessions);
    }

    getPersistableGroups() {
        return this.normalizeGroups(this.groups);
    }

    normalizeGroups(groups) {
        if (!Array.isArray(groups)) return [];

        return groups
            .filter((group) => group && typeof group.id === 'string' && group.id.trim())
            .map((group) => ({
                id: group.id,
                title:
                    typeof group.title === 'string' && group.title.trim()
                        ? group.title.trim()
                        : 'Untitled',
                timestamp:
                    Number.isFinite(group.timestamp) && group.timestamp > 0
                        ? group.timestamp
                        : Date.now(),
                isExpanded: group.isExpanded !== false,
            }));
    }

    filterPersistableSessions(sessions) {
        if (!Array.isArray(sessions)) return [];
        return sessions.filter((session) => !this.isDiscardableBlankSession(session));
    }

    isDiscardableBlankSession(session) {
        if (!session || typeof session !== 'object') return true;
        const messageCount = Array.isArray(session.messages) ? session.messages.length : 0;
        return messageCount === 0;
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter((session) => session.id !== id);
        const wasCurrent = this.currentSessionId === id;
        if (wasCurrent) {
            const nextSession = this.getSortedSessions()[0];
            this.currentSessionId = nextSession ? nextSession.id : null;
        }
        return wasCurrent;
    }

    updateSessionTitle(id, title) {
        const cleanTitle = (title || '').replace(/[\r\n]+/g, ' ').trim();
        if (!cleanTitle) return false;

        const session = this.getSessionById(id);
        if (!session) return false;

        session.title = cleanTitle;
        return true;
    }

    toggleSessionPinned(id) {
        const session = this.getSessionById(id);
        if (!session) return false;

        session.isPinned = session.isPinned !== true;
        return true;
    }

    duplicateSession(id, titleFormatter = null) {
        const session = this.getSessionById(id);
        if (!session) return null;

        const copyTitle =
            typeof titleFormatter === 'function'
                ? titleFormatter(session.title || 'New Chat')
                : `Copy of ${session.title || 'New Chat'}`;
        const duplicated = {
            ...JSON.parse(JSON.stringify(session)),
            id: generateUUID(),
            title: copyTitle,
            timestamp: Date.now(),
            context: null,
            isPinned: false,
        };

        delete duplicated.contextSummary;
        this.sessions.unshift(duplicated);
        return duplicated;
    }

    createGroup(title = 'Untitled') {
        const cleanTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Untitled';
        const newGroup = {
            id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            title: cleanTitle,
            timestamp: Date.now(),
            isExpanded: true,
        };
        this.groups.unshift(newGroup);
        return newGroup;
    }

    deleteGroup(groupId) {
        const originalLength = this.groups.length;
        this.groups = this.groups.filter((group) => group.id !== groupId);
        if (this.groups.length === originalLength) return false;

        this.sessions = this.sessions.map((session) =>
            session.groupId === groupId ? { ...session, groupId: null } : session
        );
        return true;
    }

    updateGroupTitle(groupId, title) {
        const cleanTitle = (title || '').replace(/[\r\n]+/g, ' ').trim();
        if (!cleanTitle) return false;

        const group = this.groups.find((storedGroup) => storedGroup.id === groupId);
        if (!group) return false;

        group.title = cleanTitle;
        return true;
    }

    toggleGroupExpansion(groupId) {
        const group = this.groups.find((storedGroup) => storedGroup.id === groupId);
        if (!group) return false;

        group.isExpanded = !(group.isExpanded ?? true);
        return true;
    }

    moveSessionToGroup(sessionId, groupId) {
        const session = this.getSessionById(sessionId);
        if (!session) return false;

        const normalizedGroupId =
            groupId && this.groups.some((group) => group.id === groupId) ? groupId : null;
        session.groupId = normalizedGroupId;
        return true;
    }

    updateTitle(id, text) {
        const session = this.sessions.find((storedSession) => storedSession.id === id);
        if (session) {
            const cleanText = (text || '').replace(/[\r\n]+/g, ' ').trim();
            if (cleanText) {
                session.title = cleanText.substring(0, 30) + (cleanText.length > 30 ? '...' : '');
                return true;
            }
        }
        return false;
    }

    addMessage(id, role, text, attachment = null, thoughts = null) {
        const session = this.sessions.find((storedSession) => storedSession.id === id);
        if (session) {
            const sessionMessage = { role, text };

            if (thoughts) {
                sessionMessage.thoughts = thoughts;
            }

            if (role === 'user') {
                const attachments = normalizeUserAttachments(attachment);
                if (attachments.length > 0) {
                    sessionMessage.attachments = attachments;
                    const images = getImageAttachmentDataUrls(attachments);
                    if (images.length > 0) {
                        sessionMessage.image = images;
                    }
                }
            } else if (role === 'ai' && Array.isArray(attachment) && attachment.length > 0) {
                sessionMessage.generatedImages = attachment;
            }

            session.messages.push(sessionMessage);
            session.timestamp = Date.now();
            return true;
        }
        return false;
    }

    editUserMessageAndTruncate(id, messageIndex, text) {
        const session = this.sessions.find((storedSession) => storedSession.id === id);
        if (!session || !Array.isArray(session.messages)) return null;

        const target = session.messages[messageIndex];
        if (!target || target.role !== 'user') return null;

        const previousMessages = session.messages.slice(0, messageIndex);
        const editedMessage = {
            ...target,
            text,
        };

        session.messages = [...previousMessages, editedMessage];
        session.context = null;
        session.contextSummary = null;
        session.timestamp = Date.now();

        if (messageIndex === 0) {
            this.updateTitle(id, text);
        }

        return {
            session,
            message: editedMessage,
            previousMessages,
        };
    }

    updateContext(id, context) {
        const session = this.sessions.find((storedSession) => storedSession.id === id);
        if (session) {
            session.context = context;
        }
    }
}
