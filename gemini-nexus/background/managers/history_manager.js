
// background/managers/history_manager.js
import { generateUUID } from '../../lib/utils.js';

/**
 * Saves a completed interaction to the chat history in local storage.
 * @param {string} text - The user's prompt.
 * @param {object} result - The result object from the session manager.
 * @param {Array|object} filesObj - Optional file data { base64 } or array of such objects.
 * @returns {object} The new session object or null on error.
 */
export async function saveToHistory(text, result, filesObj = null) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        
        const sessionId = generateUUID();
        const title = text.length > 30 ? text.substring(0, 30) + "..." : text;

        // Normalize image data to array of base64 strings
        let storedImages = null;
        if (filesObj) {
            if (Array.isArray(filesObj)) {
                storedImages = filesObj.map(f => f.base64);
            } else if (filesObj.base64) {
                storedImages = [filesObj.base64];
            }
        }

        const newSession = {
            id: sessionId,
            title: title || "Quick Ask",
            timestamp: Date.now(),
            messages: [
                {
                    role: 'user',
                    text: text,
                    image: storedImages // Now stores array of base64 strings
                },
                {
                    role: 'ai',
                    text: result.text,
                    thoughts: result.thoughts, // Save thoughts if present
                    thoughtsDurationSeconds: result.thoughtsDurationSeconds,
                    sources: result.sources || null,
                generatedImages: result.images, // Save generated images
                thoughtSignature: result.thoughtSignature, // Save context signature for Gemini 3
                officialContent: result.officialContent || null,
                suppressCopy: result.suppressCopy === true
                }
            ],
            context: result.context
        };

        geminiSessions.unshift(newSession);
        await chrome.storage.local.set({ geminiSessions });
        
        // Notify Sidepanel to reload if open
        chrome.runtime.sendMessage({ 
            action: "SESSIONS_UPDATED", 
            sessions: geminiSessions 
        }).catch(() => {}); 
        
        return newSession;
    } catch(e) {
        console.error("Error saving history:", e);
        return null;
    }
}

/**
 * Appends an AI response to an existing session in local storage.
 * Critical for ensuring history is saved even if the UI is closed during generation.
 * @param {string} sessionId 
 * @param {object} result 
 */
export async function appendAiMessage(sessionId, result) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex !== -1) {
            const session = geminiSessions[sessionIndex];
            
            session.messages.push({
                role: 'ai',
                text: result.text,
                thoughts: result.thoughts,
                thoughtsDurationSeconds: result.thoughtsDurationSeconds,
                sources: result.sources || null,
                generatedImages: result.images,
                thoughtSignature: result.thoughtSignature, // Save context signature for Gemini 3
                officialContent: result.officialContent || null,
                suppressCopy: result.suppressCopy === true
            });
            session.context = result.context; // Update context
            session.timestamp = Date.now();
            
            // Move to top
            geminiSessions.splice(sessionIndex, 1);
            geminiSessions.unshift(session);
            
            await chrome.storage.local.set({ geminiSessions });
            
            chrome.runtime.sendMessage({ 
                action: "SESSIONS_UPDATED", 
                sessions: geminiSessions 
            }).catch(() => {});
            
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error appending history:", e);
        return false;
    }
}

export async function appendRawMessages(sessionId, messages) {
    try {
        if (!sessionId || !Array.isArray(messages) || messages.length === 0) return false;

        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);

        if (sessionIndex === -1) return false;

        const session = geminiSessions[sessionIndex];
        messages.forEach(message => {
            if (message && typeof message === 'object') {
                session.messages.push(message);
            }
        });
        session.timestamp = Date.now();

        geminiSessions.splice(sessionIndex, 1);
        geminiSessions.unshift(session);

        await chrome.storage.local.set({ geminiSessions });

        chrome.runtime.sendMessage({
            action: "SESSIONS_UPDATED",
            sessions: geminiSessions
        }).catch(() => {});

        return true;
    } catch (e) {
        console.error("Error appending raw history messages:", e);
        return false;
    }
}

export async function appendAiMessageIfDisplayable(sessionId, result) {
    const text = typeof result?.text === 'string' ? result.text : '';
    const thoughts = typeof result?.thoughts === 'string' ? result.thoughts : '';
    const hasText = text.trim().length > 0;
    const hasThoughts = thoughts.trim().length > 0;
    const hasThoughtSignature = typeof result?.thoughtSignature === 'string'
        && result.thoughtSignature.trim().length > 0;

    if (!hasText && !hasThoughts && !hasThoughtSignature) {
        return false;
    }

    return appendAiMessage(sessionId, {
        ...result,
        text,
        thoughts: hasThoughts ? thoughts : null
    });
}

/**
 * Appends a User message (or Tool Output) to an existing session.
 * Used for the automated browser control loop.
 * @param {string} sessionId 
 * @param {string} text 
 * @param {Array} images - Optional array of base64 image strings
 * @param {object} metadata - Optional structured metadata for non-chat UI rows.
 */
export async function appendUserMessage(sessionId, text, images = null, metadata = null) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex !== -1) {
            const session = geminiSessions[sessionIndex];
            
            const message = {
                role: 'user',
                text: text,
                image: images // Store image array if present
            };

            if (metadata && typeof metadata === 'object') {
                Object.entries(metadata).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        message[key] = value;
                    }
                });
            }

            session.messages.push(message);
            session.timestamp = Date.now();
            
            // Move to top
            geminiSessions.splice(sessionIndex, 1);
            geminiSessions.unshift(session);
            
            await chrome.storage.local.set({ geminiSessions });
            
            chrome.runtime.sendMessage({ 
                action: "SESSIONS_UPDATED", 
                sessions: geminiSessions 
            }).catch(() => {});
            
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error appending user message:", e);
        return false;
    }
}

/**
 * Replaces a session snapshot before generation starts.
 * Keeps background storage aligned with UI-side edits before AI replies are appended.
 * @param {object} sessionSnapshot
 */
export async function replaceSessionSnapshot(sessionSnapshot) {
    try {
        if (!sessionSnapshot || !sessionSnapshot.id || !Array.isArray(sessionSnapshot.messages)) {
            return false;
        }

        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionSnapshot.id);
        const nextSession = {
            ...sessionSnapshot,
            timestamp: sessionSnapshot.timestamp || Date.now()
        };

        if (sessionIndex !== -1) {
            geminiSessions.splice(sessionIndex, 1);
        }

        geminiSessions.unshift(nextSession);
        await chrome.storage.local.set({ geminiSessions });

        chrome.runtime.sendMessage({
            action: "SESSIONS_UPDATED",
            sessions: geminiSessions
        }).catch(() => {});

        return true;
    } catch (e) {
        console.error("Error replacing session snapshot:", e);
        return false;
    }
}

export async function getSessionContextSummary(sessionId) {
    if (!sessionId) return null;

    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const session = geminiSessions.find(s => s.id === sessionId);
        return session?.contextSummary || null;
    } catch (e) {
        console.error("Error reading context summary:", e);
        return null;
    }
}

export async function updateSessionContextSummary(sessionId, contextSummary) {
    if (!sessionId || !contextSummary) return false;

    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return false;

        geminiSessions[sessionIndex].contextSummary = contextSummary;
        await chrome.storage.local.set({ geminiSessions });
        return true;
    } catch (e) {
        console.error("Error updating context summary:", e);
        return false;
    }
}
