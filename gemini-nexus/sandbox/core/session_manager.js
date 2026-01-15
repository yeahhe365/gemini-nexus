
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
        this.sessions = sessions || [];
    }

    getCurrentSession() {
        return this.sessions.find(s => s.id === this.currentSessionId);
    }

    getSortedSessions() {
        return [...this.sessions].sort((a, b) => b.timestamp - a.timestamp);
    }

    setCurrentId(id) {
        this.currentSessionId = id;
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

    deleteMessage(id, messageIndex) {
        const session = this.sessions.find(s => s.id === id);
        if (session && session.messages[messageIndex]) {
            const message = session.messages[messageIndex];

            // If it's a user message, also delete the corresponding AI response
            if (message.role === 'user' && session.messages[messageIndex + 1] &&
                session.messages[messageIndex + 1].role === 'ai') {
                session.messages.splice(messageIndex, 2);
            } else if (message.role === 'ai' && messageIndex > 0 &&
                       session.messages[messageIndex - 1].role === 'user') {
                // If it's an AI message, also delete the user message before it
                session.messages.splice(messageIndex - 1, 2);
            } else {
                // Delete just this message
                session.messages.splice(messageIndex, 1);
            }

            session.timestamp = Date.now();
        }
    }

    updateContext(id, context) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            session.context = context;
        }
    }
}
