import { describe, expect, it } from 'vitest';
import { SessionManager } from './session_manager.js';

describe('SessionManager draft and persistence state', () => {
    it('uses null currentSessionId for draft state', () => {
        const manager = new SessionManager();
        const session = manager.createSession();

        expect(manager.currentSessionId).toBe(session.id);

        manager.enterDraft();

        expect(manager.currentSessionId).toBeNull();
        expect(manager.getCurrentSession()).toBeNull();
    });

    it('filters blank sessions during restore, sorting, and persistence', () => {
        const manager = new SessionManager();
        const blankSession = {
            id: 'blank',
            title: 'New Chat',
            timestamp: 200,
            messages: []
        };
        const realSession = {
            id: 'real',
            title: 'Hello',
            timestamp: 100,
            messages: [{ role: 'user', text: 'Hello' }]
        };

        manager.currentSessionId = blankSession.id;
        manager.setSessions([blankSession, realSession]);

        expect(manager.currentSessionId).toBeNull();
        expect(manager.sessions).toEqual([realSession]);
        expect(manager.getPersistableSessions()).toEqual([realSession]);
        expect(manager.getSortedSessions()).toEqual([realSession]);
    });

    it('does not invent a new session after deleting the last persisted session', () => {
        const manager = new SessionManager();
        manager.setSessions([
            {
                id: 'real',
                title: 'Hello',
                timestamp: 100,
                messages: [{ role: 'user', text: 'Hello' }]
            }
        ]);
        manager.setCurrentId('real');

        const switchNeeded = manager.deleteSession('real');

        expect(switchNeeded).toBe(true);
        expect(manager.sessions).toEqual([]);
        expect(manager.currentSessionId).toBeNull();
        expect(manager.getPersistableSessions()).toEqual([]);
    });
});
