
// background/handlers/session/prompt_handler.js
import { appendAiMessage, appendUserMessage } from '../../managers/history_manager.js';
import { PromptBuilder } from './prompt/builder.js';
import { ToolExecutor } from './prompt/tool_executor.js';

// Helper to prevent rapid-fire requests that trigger rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class PromptHandler {
    constructor(sessionManager, controlManager) {
        this.sessionManager = sessionManager;
        this.controlManager = controlManager;
        this.builder = new PromptBuilder(controlManager);
        this.toolExecutor = new ToolExecutor(controlManager);
    }

    handle(request, sendResponse) {
        (async () => {
            const onUpdate = (partialText, partialThoughts) => {
                // Catch errors if receiver (UI) is closed/unavailable
                chrome.runtime.sendMessage({
                    action: "GEMINI_STREAM_UPDATE",
                    text: partialText,
                    thoughts: partialThoughts
                }).catch(() => {}); 
            };

            try {
                // AUTO-LOCK: If browser control enabled and no tab locked, lock to active tab
                if (request.enableBrowserControl && this.controlManager) {
                    const currentLock = this.controlManager.getTargetTabId();
                    if (!currentLock) {
                        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                        if (tabs.length > 0) {
                            const tab = tabs[0];
                            this.controlManager.setTargetTab(tab.id);
                            
                            // Notify UI to update the Tab Switcher icon so user knows which tab is locked
                            chrome.runtime.sendMessage({
                                action: "TAB_LOCKED",
                                tab: {
                                    id: tab.id,
                                    title: tab.title,
                                    favIconUrl: tab.favIconUrl,
                                    url: tab.url,
                                    active: tab.active
                                }
                            }).catch(() => {});
                        }
                    }
                }

                // 1. Build Initial Prompt (with Preamble/Context separated)
                const buildResult = await this.builder.build(request);
                const systemInstruction = buildResult.systemInstruction;
                let currentPromptText = buildResult.userPrompt;
                
                let currentFiles = request.files;
                
                let loopCount = 0;
                // 0 means unlimited (Infinity). Default to 0 if undefined.
                const reqLoops = request.maxLoops !== undefined ? request.maxLoops : 0;
                const MAX_LOOPS = reqLoops === 0 ? Infinity : reqLoops;
                
                let keepLooping = true;

                // --- AUTOMATED FEEDBACK LOOP ---
                while (keepLooping && loopCount < MAX_LOOPS) {
                    
                    // 2. Send to Gemini
                    const result = await this.sessionManager.handleSendPrompt({
                        ...request,
                        text: currentPromptText,
                        systemInstruction: systemInstruction, // Pass system instruction
                        files: currentFiles
                    }, onUpdate);

                    if (!result || result.status !== 'success') {
                        // If error, notify UI and break loop
                        if (result) chrome.runtime.sendMessage(result).catch(() => {});
                        break;
                    }

                    // 3. Save AI Response to History
                    if (request.sessionId) {
                        await appendAiMessage(request.sessionId, result);
                    }
                    
                    // Notify UI of the result (replaces streaming bubble)
                    chrome.runtime.sendMessage(result).catch(() => {});

                    // 4. Process Tool Execution (if any)
                    let toolResult = null;
                    if (request.enableBrowserControl) {
                        toolResult = await this.toolExecutor.executeIfPresent(result.text, onUpdate);
                    }

                    // 5. Decide Next Step
                    if (toolResult) {
                        // Tool executed, feed back to model (Loop continues)
                        loopCount++;
                        currentFiles = toolResult.files || []; // Send new files if any, or clear previous files
                        
                        let outputForModel = toolResult.output;
                        
                        // --- AUTO-SNAPSHOT INJECTION ---
                        // Automatically inject the Accessibility Tree if the tool implies a state change.
                        // We skip purely observational tools to save processing/tokens if they don't change state.
                        const skipSnapshotTools = [
                            'take_snapshot', 
                            'take_screenshot', 
                            'get_logs', 
                            'list_network_requests', 
                            'get_network_request', 
                            'performance_start_trace', 
                            'performance_stop_trace',
                            'list_pages'
                        ];
                        
                        if (request.enableBrowserControl && this.controlManager && !skipSnapshotTools.includes(toolResult.toolName)) {
                             try {
                                 // Inject current URL and Accessibility Tree
                                 const targetTabId = this.controlManager.getTargetTabId();
                                 let urlInfo = "";
                                 if (targetTabId) {
                                     try {
                                         const tab = await chrome.tabs.get(targetTabId);
                                         urlInfo = `[Current URL]: ${tab.url}\n`;
                                     } catch(e) {}
                                 }

                                 const snapshot = await this.controlManager.getSnapshot();
                                 if (snapshot && typeof snapshot === 'string' && !snapshot.startsWith('Error')) {
                                     outputForModel += `\n\n${urlInfo}[Updated Page Accessibility Tree]:\n\`\`\`text\n${snapshot}\n\`\`\`\n`;
                                 }
                             } catch(e) {
                                 console.warn("Auto-snapshot injection failed:", e);
                             }
                        }

                        // Format observation for the model
                        currentPromptText = `[Tool Output from ${toolResult.toolName}]:\n\`\`\`\n${outputForModel}\n\`\`\`\n\n(Proceed with the next step or confirm completion)`;
                        
                        // Save "User" message (Tool Output) to history to keep context in sync
                        // NOTE: We do NOT save the massive auto-snapshot text to the user history to keep the UI clean.
                        if (request.sessionId) {
                            const userMsg = `🛠️ **Tool Output:**\n\`\`\`\n${toolResult.output}\n\`\`\`\n\n*(Proceeding to step ${loopCount + 1})*`;
                            
                            let historyImages = toolResult.files ? toolResult.files.map(f => f.base64) : null;
                            await appendUserMessage(request.sessionId, userMsg, historyImages);
                        }
                        
                        // Update UI status
                        const loopStatus = MAX_LOOPS === Infinity ? `${loopCount}` : `${loopCount}/${MAX_LOOPS}`;
                        onUpdate("Gemini is thinking...", `Observed output from tool. Planning next step (${loopStatus})...`);
                        
                        // === RATE LIMIT MITIGATION ===
                        // Wait 2-4 seconds before sending the next request.
                        // This prevents "No valid response" errors caused by rapid-fire requests.
                        await delay(2000 + Math.random() * 2000);
                        
                    } else {
                        // No tool execution, final answer reached
                        keepLooping = false;
                    }
                }

            } catch (e) {
                console.error("Prompt loop error:", e);
                chrome.runtime.sendMessage({
                    action: "GEMINI_REPLY",
                    text: "Error: " + e.message,
                    status: "error"
                }).catch(() => {});
            } finally {
                sendResponse({ status: "completed" });
            }
        })();
        return true;
    }
}
