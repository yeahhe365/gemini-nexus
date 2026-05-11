
// sandbox/core/session_manager.js
import { generateUUID } from '../../lib/utils.js';

export class SessionManager {
    constructor() {
        this.sessions = [];
        this.currentSessionId = null;
    }

    createSession() {
        const newId = generateUUID();
        const newSession = {
            id: newId,
            title: "New Chat",
            timestamp: Date.now(),
            messages: [],
            context: null // Gemini context IDs
        };
        this.sessions.unshift(newSession); // Add to top
        this.currentSessionId = newId;
        return newSession;
    }

    setSessions(sessions) {
        this.sessions = this.filterPersistableSessions(sessions || []);
        if (this.currentSessionId && !this.getSessionById(this.currentSessionId)) {
            this.currentSessionId = null;
        }
    }

    getCurrentSession() {
        return this.getSessionById(this.currentSessionId);
    }

    getSortedSessions() {
        return this.getPersistableSessions().sort((a, b) => b.timestamp - a.timestamp);
    }

    setCurrentId(id) {
        this.currentSessionId = this.getSessionById(id) ? id : null;
    }

    enterDraft() {
        this.currentSessionId = null;
    }

    getSessionById(id) {
        if (!id) return null;
        return this.sessions.find(s => s.id === id) || null;
    }

    getPersistableSessions() {
        return this.filterPersistableSessions(this.sessions);
    }

    filterPersistableSessions(sessions) {
        if (!Array.isArray(sessions)) return [];
        return sessions.filter(session => !this.isDiscardableBlankSession(session));
    }

    isDiscardableBlankSession(session) {
        if (!session || typeof session !== 'object') return true;
        const messageCount = Array.isArray(session.messages) ? session.messages.length : 0;
        return messageCount === 0;
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter(s => s.id !== id);
        // If deleted current session, return true to signal a switch is needed
        const wasCurrent = (this.currentSessionId === id);
        if (wasCurrent) {
            this.currentSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
        }
        return wasCurrent;
    }

    updateTitle(id, text) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            // Clean text (remove newlines) for display
            const cleanText = (text || "").replace(/[\r\n]+/g, " ").trim();
            if (cleanText) {
                session.title = cleanText.substring(0, 30) + (cleanText.length > 30 ? "..." : "");
                return true;
            }
        }
        return false;
    }

    addMessage(id, role, text, attachment = null, thoughts = null) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            const msg = { role, text };
            
            if (thoughts) {
                msg.thoughts = thoughts;
            }
            
            // Handle attachments based on role
            if (role === 'user' && typeof attachment === 'string') {
                // Backward compatibility: user attachment is usually a single base64 string
                msg.image = attachment; 
            } else if (role === 'user' && Array.isArray(attachment) && attachment.length > 0) {
                msg.image = attachment;
            } else if (role === 'ai' && Array.isArray(attachment) && attachment.length > 0) {
                // AI generated images
                msg.generatedImages = attachment;
            }

            session.messages.push(msg);
            session.timestamp = Date.now();
            return true;
        }
        return false;
    }

    editUserMessageAndTruncate(id, messageIndex, text) {
        const session = this.sessions.find(s => s.id === id);
        if (!session || !Array.isArray(session.messages)) return null;

        const target = session.messages[messageIndex];
        if (!target || target.role !== 'user') return null;

        const previousMessages = session.messages.slice(0, messageIndex);
        const editedMessage = {
            ...target,
            text
        };

        session.messages = [
            ...previousMessages,
            editedMessage
        ];
        session.context = null;
        session.contextSummary = null;
        session.timestamp = Date.now();

        if (messageIndex === 0) {
            this.updateTitle(id, text);
        }

        return {
            session,
            message: editedMessage,
            previousMessages
        };
    }

    updateContext(id, context) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            session.context = context;
        }
    }
}
