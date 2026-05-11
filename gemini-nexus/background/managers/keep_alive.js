
// background/managers/keep_alive.js

const ALARM_NAME = 'gemini_cookie_rotate';
const ROTATE_URL = "https://accounts.google.com/RotateCookies";
// Matches Python implementation (540s = 9 minutes)
const INTERVAL_MINUTES = 9; 

export class KeepAliveManager {
    constructor() {
        this.lastRotation = 0;
        this.isRotating = false;
        this.consecutiveErrors = 0;
    }

    init() {
        // Ensure alarm is set up
        chrome.alarms.get(ALARM_NAME, (alarm) => {
            if (!alarm) {
                chrome.alarms.create(ALARM_NAME, { periodInMinutes: INTERVAL_MINUTES });
            }
        });

        // Add listener (ensure single binding)
        if (!chrome.alarms.onAlarm.hasListener(this._onAlarm.bind(this))) {
            chrome.alarms.onAlarm.addListener(this._onAlarm.bind(this));
        }

        // Perform initial check immediately on load
        this.performRotation();
    }

    _onAlarm(alarm) {
        if (alarm.name === ALARM_NAME) {
            this.performRotation();
        }
    }

    async performRotation() {
        const now = Date.now();
        // Throttling: Don't rotate if successfully done in last 60s 
        // (Matches Python logic to avoid 429 Too Many Requests)
        if (now - this.lastRotation < 60000) {
            return;
        }

        if (this.isRotating) return;
        this.isRotating = true;

        try {
            // console.debug("[Gemini Nexus] Keep-Alive: Rotating cookies...");
            
            // This endpoint refreshes __Secure-1PSIDTS
            // Browser automatically handles the Cookie header in request and Set-Cookie in response
            // due to host permissions.
            const response = await fetch(ROTATE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                // Raw payload compatible with Google's endpoint logic
                // [000,"-0000000000000000000"]
                body: '[000,"-0000000000000000000"]'
            });

            if (response.ok) {
                this.lastRotation = Date.now();
                this.consecutiveErrors = 0;
                // console.debug("[Gemini Nexus] Keep-Alive: Rotation successful");
            } else {
                this.consecutiveErrors++;
                this._handleError(response.status);
            }
        } catch (e) {
            this.consecutiveErrors++;
            console.error("[Gemini Nexus] Keep-Alive: Network error", e);
        } finally {
            this.isRotating = false;
        }
    }

    async _handleError(status) {
        console.warn(`[Gemini Nexus] Keep-Alive: Rotation failed with status ${status}`);

        // If 401 Unauthorized or 403 Forbidden, session is likely dead.
        // We clear the context so the next user action triggers a fresh auth check.
        if (status === 401 || status === 403) {
            console.log("[Gemini Nexus] Session expired. Clearing local context.");
            await chrome.storage.local.remove(['geminiContext']);
        }
        
        // If 429 Too Many Requests, do nothing, just wait for next interval.
    }
}

// Export singleton instance
export const keepAliveManager = new KeepAliveManager();
