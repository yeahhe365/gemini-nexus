
// background/control/actions/observation.js
import { BaseActionHandler } from './base.js';

export class ObservationActions extends BaseActionHandler {
    
    async takeScreenshot({ filePath } = {}) {
        try {
            const dataUrl = await new Promise(resolve => {
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, (data) => {
                    if (chrome.runtime.lastError) {
                        console.error("Screenshot failed:", chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                });
            });

            if (!dataUrl) return "Error: Failed to capture screenshot.";

            let message = `Screenshot taken (Base64 length: ${dataUrl.length}).`;

            // If a filePath (filename) is provided, download it
            if (filePath) {
                try {
                    // Extract safe filename from path
                    const filename = filePath.split(/[/\\]/).pop() || 'screenshot.png';

                    const downloadId = await new Promise((resolve, reject) => {
                        chrome.downloads.download({
                            url: dataUrl,
                            filename: filename,
                            saveAs: false // Don't prompt save as dialog
                        }, (id) => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                            else resolve(id);
                        });
                    });
                    message += ` Saved to ${filename} (Download ID: ${downloadId}).`;
                } catch (err) {
                    message += ` Failed to save: ${err.message}`;
                }
            } else {
                message += " [Internal: Image attached to chat history]";
            }

            return {
                text: message,
                image: dataUrl
            };
        } catch (e) {
            return `Error taking screenshot: ${e.message}`;
        }
    }

    /**
     * Evaluates a script in the browser context.
     * Supports passing arguments (including DOM elements via UIDs).
     */
    async evaluateScript({ script, args = [] }) {
        try {
            const callArguments = [];

            // Resolve arguments: UIDs to ObjectIds
            if (args && Array.isArray(args)) {
                for (const arg of args) {
                    if (typeof arg === 'object' && arg !== null && arg.uid) {
                        // Argument is a DOM reference
                        try {
                            const objectId = await this.getObjectIdFromUid(arg.uid);
                            callArguments.push({ objectId });
                        } catch (e) {
                            return `Error: Could not resolve argument with uid ${arg.uid}: ${e.message}`;
                        }
                    } else {
                        // Regular JSON argument
                        callArguments.push({ value: arg });
                    }
                }
            }

            // If we have object arguments, we must use Runtime.callFunctionOn
            // If no args, we can treat the script as an expression or a function declaration.
            // For robustness, we wrap it to ensure async/await support.
            
            // NOTE: Chrome DevTools MCP passes the script as a function declaration string: "function(a, b) { ... }"
            // If the user provided a raw string "document.title", we wrap it.
            
            let functionDeclaration = script.trim();
            const isFunction = functionDeclaration.startsWith('function') || functionDeclaration.startsWith('async function') || functionDeclaration.startsWith('(') || functionDeclaration.includes('=>');

            if (!isFunction) {
                // Wrap simple expressions in a function
                functionDeclaration = `function() { return (${script}); }`;
            }

            // Ensure it's treated as a function declaration by CDP
            // If the script is "() => { ... }", CDP accepts it as functionDeclaration.
            
            const res = await this.cmd("Runtime.callFunctionOn", {
                functionDeclaration: functionDeclaration,
                arguments: callArguments,
                executionContextId: undefined, // Default context
                returnByValue: true, // Return JSON result
                awaitPromise: true,  // Support async
                userGesture: true
            });

            if (res.exceptionDetails) {
                return `Script Exception: ${res.exceptionDetails.text} ${res.exceptionDetails.exception ? res.exceptionDetails.exception.description : ''}`;
            }

            if (res.result) {
                if (res.result.type === 'undefined') return "undefined";
                
                // Return structured JSON for objects, string for primitives
                const val = res.result.value;
                if (typeof val === 'object' && val !== null) {
                    return JSON.stringify(val, null, 2);
                }
                return String(val);
            }
            
            return "undefined";
        } catch (e) {
            return `Error evaluating script: ${e.message}`;
        }
    }

    async waitFor({ text, timeout = 5000 }) {
        try {
            // Poll for text presence in the DOM
            const res = await this.cmd("Runtime.evaluate", {
                expression: `
                    (async () => {
                        const start = Date.now();
                        const target = "${String(text).replace(/"/g, '\\"')}";
                        while (Date.now() - start < ${timeout}) {
                            if (document.body && document.body.innerText.includes(target)) {
                                return true;
                            }
                            await new Promise(r => setTimeout(r, 200));
                        }
                        return false;
                    })()
                `,
                awaitPromise: true,
                returnByValue: true
            });
            
            if (res.result && res.result.value === true) {
                return `Found text "${text}".`;
            } else {
                return `Timeout waiting for text "${text}" after ${timeout}ms.`;
            }
        } catch (e) {
            return `Error waiting for text: ${e.message}`;
        }
    }

    async getLogs() {
        const logs = this.connection.collectors.logs.getFormatted();
        const dialogStatus = this.connection.collectors.dialogs.getFormatted();
        
        let output = "";
        
        if (dialogStatus) {
            output += `!!! ALERT: ${dialogStatus} !!!\n(You must use 'handle_dialog' to clear this before proceeding)\n\n`;
        }
        
        output += (logs || "No logs captured.");
        return output;
    }

    async getNetworkActivity() {
        const net = this.connection.collectors.network.getFormatted();
        return net || "No network activity captured.";
    }

    async listNetworkRequests({ resourceTypes, limit = 20 }) {
        const collector = this.connection.collectors.network;
        const requests = collector.getList(resourceTypes, limit);
        
        if (requests.length === 0) return "No matching network requests found.";

        return requests.map(r => 
            `ID: ${r.id} | ${r.method} ${r.url} | Status: ${r.status} | Type: ${r.type}`
        ).join('\n');
    }

    async getNetworkRequest({ requestId }) {
        const req = this.connection.collectors.network.getRequest(requestId);
        if (!req) return `Error: Request ID ${requestId} not found. Use list_network_requests first.`;

        let body = "Not available (Request might be incomplete or garbage collected)";
        
        // Try to fetch body from CDP if request completed
        if (req.completed) {
            try {
                const res = await this.cmd("Network.getResponseBody", { requestId });
                body = res.body;
                
                if (res.base64Encoded) {
                     // Attempt to decode if it looks like text
                     if (req.mimeType && (req.mimeType.includes('json') || req.mimeType.includes('text') || req.mimeType.includes('xml'))) {
                         try {
                            body = atob(res.body);
                         } catch (e) {
                            body = "<Base64 Encoded Binary>";
                         }
                     } else {
                         body = "<Base64 Encoded Binary>";
                     }
                }
            } catch (e) {
                // Ignore, body might be gone or not available
                body = `Body fetch failed: ${e.message}`;
            }
        }

        return JSON.stringify({
            url: req.url,
            method: req.method,
            type: req.type,
            status: req.status,
            requestHeaders: req.requestHeaders,
            responseHeaders: req.responseHeaders,
            postData: req.postData,
            responseBody: body
        }, null, 2);
    }
}
