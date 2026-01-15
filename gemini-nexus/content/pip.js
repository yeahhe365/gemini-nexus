
// content/pip.js
// Document Picture-in-Picture (PIP) Window Manager
// Allows Gemini Nexus to float above any application

/**
 * Global state for PIP window
 */
let pipWindowInstance = null;
let pipWindowState = {
    isMinimized: false,
    previousSize: { width: 500, height: 800 },
    created: false
};

/**
 * Check if Document PIP API is supported
 */
function isPipSupported() {
    return 'documentPictureInPicture' in window;
}

/**
 * Copy stylesheets from source document to target PIP window
 * @param {Window} targetWindow - The PIP window
 * @param {Document} sourceDoc - Source document
 */
function copyStyleSheets(targetWindow, sourceDoc) {
    // Copy all stylesheets
    Array.from(sourceDoc.styleSheets).forEach(styleSheet => {
        try {
            if (styleSheet.href) {
                // External stylesheet
                const link = targetWindow.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleSheet.href;
                targetWindow.document.head.appendChild(link);
            } else if (styleSheet.cssRules) {
                // Inline stylesheet
                const style = targetWindow.document.createElement('style');
                Array.from(styleSheet.cssRules).forEach(rule => {
                    style.appendChild(targetWindow.document.createTextNode(rule.cssText));
                });
                targetWindow.document.head.appendChild(style);
            }
        } catch (e) {
            console.warn('[PIP] Could not copy stylesheet:', e);
        }
    });
}

/**
 * Create the PIP window with Gemini Nexus interface
 * @returns {Promise<Window>} The PIP window instance
 */
async function createPipWindow() {
    if (!isPipSupported()) {
        throw new Error('Document Picture-in-Picture API is not supported in this browser. Requires Chrome 111+');
    }

    // Check if a PIP window already exists
    if (window.documentPictureInPicture.window) {
        console.log('[PIP] Window already exists, returning existing window');
        return window.documentPictureInPicture.window;
    }

    try {
        // CRITICAL: Detect system theme in main page context (most reliable)
        // PIP window's prefers-color-scheme detection is unreliable
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        console.log('[PIP] System theme detected in main page:', systemDark ? 'dark' : 'light');

        // Request PIP window
        const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: pipWindowState.previousSize.width,
            height: pipWindowState.previousSize.height,
        });

        pipWindowInstance = pipWindow;
        pipWindowState.created = true;
        pipWindowState.isMinimized = false;

        console.log('[PIP] Window created successfully');

        // SOLUTION: Use DOM API to avoid CSP violations (no document.write with inline scripts)
        // Inspired by anything-copilot implementation
        // IMPORTANT: Pass PIP context and system theme as URL parameters
        const sidebarUrl = chrome.runtime.getURL('sidepanel/index.html') +
            `?inPip=true&systemTheme=${systemDark ? 'dark' : 'light'}`;
        console.log('[PIP] Creating iframe for:', sidebarUrl);

        // Create style element
        const style = pipWindow.document.createElement('style');
        style.textContent = `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: ${systemDark ? '#131314' : '#ffffff'};
            }
            iframe {
                width: 100%;
                height: 100%;
                border: none;
                display: block;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // Set title
        pipWindow.document.title = 'Gemini Nexus - Floating Window';

        // Create iframe element
        const iframe = pipWindow.document.createElement('iframe');
        iframe.id = 'sidepanel-frame';
        iframe.src = sidebarUrl;
        iframe.setAttribute('allow', 'clipboard-write');
        pipWindow.document.body.appendChild(iframe);

        console.log('[PIP] Iframe-based sidepanel created');
        console.log('[PIP] Full Chrome API access enabled - sessions and settings preserved');

        // Wait for iframe to load
        await new Promise((resolve) => {
            iframe.addEventListener('load', () => {
                console.log('[PIP] Sidepanel iframe loaded successfully');
                resolve();
            }, { once: true });
        });

        // Setup event listeners
        setupPipWindowListeners(pipWindow);

        // Store window state in chrome.storage
        await chrome.storage.local.set({
            pipWindow: {
                created: true,
                timestamp: Date.now(),
                width: pipWindow.outerWidth,
                height: pipWindow.outerHeight
            }
        });

        return pipWindow;

    } catch (error) {
        console.error('[PIP] Failed to create window:', error);
        pipWindowState.created = false;
        throw error;
    }
}

/**
 * Setup listeners for PIP window events
 * @param {Window} pipWindow - The PIP window instance
 */
function setupPipWindowListeners(pipWindow) {
    // Listen for window close
    pipWindow.addEventListener('pagehide', async () => {
        console.log('[PIP] Window closed');

        // Store window size before closing
        pipWindowState.previousSize = {
            width: pipWindow.outerWidth,
            height: pipWindow.outerHeight
        };

        pipWindowInstance = null;
        pipWindowState.created = false;

        // Clear storage
        await chrome.storage.local.remove('pipWindow');
    });

    // Listen for resize
    pipWindow.addEventListener('resize', () => {
        pipWindowState.previousSize = {
            width: pipWindow.outerWidth,
            height: pipWindow.outerHeight
        };
    });

    // Prevent default navigation and handle links
    pipWindow.addEventListener('click', (e) => {
        const target = e.target.closest('a[href]');
        if (target && target.href) {
            const href = target.getAttribute('href');

            // Handle external links - open in main browser
            if (href.startsWith('http://') || href.startsWith('https://')) {
                e.preventDefault();
                chrome.runtime.sendMessage({
                    action: 'OPEN_URL_IN_TAB',
                    url: target.href
                });
            }
        }
    });
}

/**
 * Toggle PIP window minimize state
 */
async function toggleMinimize() {
    const pipWindow = window.documentPictureInPicture.window;

    if (!pipWindow) {
        console.warn('[PIP] No window to minimize');
        return;
    }

    if (pipWindowState.isMinimized) {
        // Restore
        pipWindow.resizeTo(
            pipWindowState.previousSize.width,
            pipWindowState.previousSize.height
        );
        pipWindowState.isMinimized = false;
        console.log('[PIP] Window restored');
    } else {
        // Minimize
        pipWindowState.previousSize = {
            width: pipWindow.outerWidth,
            height: pipWindow.outerHeight
        };
        pipWindow.resizeTo(64, 64);
        pipWindowState.isMinimized = true;
        console.log('[PIP] Window minimized');
    }
}

/**
 * Close the PIP window
 */
async function closePipWindow() {
    const pipWindow = window.documentPictureInPicture.window;

    if (pipWindow) {
        pipWindow.close();
        console.log('[PIP] Window closed manually');
    }
}

/**
 * Check if PIP window exists
 * @returns {boolean}
 */
function hasPipWindow() {
    return !!window.documentPictureInPicture.window;
}

/**
 * Get current PIP window
 * @returns {Window|null}
 */
function getPipWindow() {
    return window.documentPictureInPicture.window;
}

/**
 * Handle messages from background or other contexts
 * @param {Object} message - Message object
 */
async function handlePipMessage(message) {
    switch (message.action) {
        case 'PIP_CREATE':
            try {
                await createPipWindow();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }

        case 'PIP_TOGGLE_MINIMIZE':
            await toggleMinimize();
            return { success: true };

        case 'PIP_CLOSE':
            await closePipWindow();
            return { success: true };

        case 'PIP_CHECK':
            return {
                success: true,
                exists: hasPipWindow(),
                supported: isPipSupported(),
                isMinimized: pipWindowState.isMinimized
            };

        default:
            return { success: false, error: 'Unknown PIP action' };
    }
}

// Export functions for use in other content scripts
window.GeminiPip = {
    create: createPipWindow,
    close: closePipWindow,
    toggleMinimize: toggleMinimize,
    has: hasPipWindow,
    get: getPipWindow,
    isSupported: isPipSupported,
    handle: handlePipMessage
};

console.log('[PIP] Module initialized', { supported: isPipSupported() });
