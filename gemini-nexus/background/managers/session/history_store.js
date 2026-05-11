
// background/managers/session/history_store.js

export async function getHistory(sessionId) {
    if (!sessionId) return [];
    const { geminiSessions } = await chrome.storage.local.get(['geminiSessions']);
    const session = geminiSessions ? geminiSessions.find(s => s.id === sessionId) : null;
    if (session && session.messages) {
        return session.messages;
    }
    return [];
}
