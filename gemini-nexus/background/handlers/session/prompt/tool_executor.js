// background/handlers/session/prompt/tool_executor.js
import { parseToolCommand } from '../utils.js';
import { ToolDispatcher } from '../../../control/dispatcher.js';

export class ToolExecutor {
    constructor(controlManager, mcpManager) {
        this.controlManager = controlManager;
        this.mcpManager = mcpManager;
    }

    async executeIfPresent(text, request, onUpdate) {
        const toolCommand = parseToolCommand(text);
        if (!toolCommand) return null;

        return this.executeCommand(toolCommand, request, text || "");
    }

    async executeFunctionCalls(functionCalls, request) {
        const calls = Array.isArray(functionCalls) ? functionCalls : [];
        const validCalls = calls.filter(call => call && typeof call.name === 'string' && call.name.trim());
        const results = [];

        for (const [index, call] of validCalls.entries()) {
            results.push(await this.executeCommand({
                name: call.name,
                args: call.args || {},
                id: call.id || null
            }, request, this.formatFunctionCallText(call), {
                callIndex: index + 1,
                callCount: validCalls.length
            }));
        }

        return results;
    }

    async executeCommand(toolCommand, request, toolCallText = "", callMeta = {}) {
        const toolName = toolCommand.name;
        const callIndex = Number.isFinite(callMeta.callIndex) ? callMeta.callIndex : null;
        const callCount = Number.isFinite(callMeta.callCount) ? callMeta.callCount : null;
        const statusKey = this.createToolStatusKey(request, toolName, callIndex, callCount);
        this.sendToolStatus(request, {
            statusKey,
            toolName,
            status: "running",
            toolCallText,
            callIndex,
            callCount
        });

        let output = "";
        let files = null;
        let source = "unknown";
        let status = "completed";

        try {
            if (ToolDispatcher.isLocalTool(toolName)) {
                if (!this.controlManager) {
                    throw new Error('Browser control is unavailable.');
                }

                source = "browser_control";
                const execResult = await this.controlManager.execute({
                    name: toolName,
                    args: toolCommand.args || {}
                });

                if (execResult && typeof execResult === 'object' && execResult.image) {
                    output = execResult.text;
                    files = [{
                        base64: execResult.image,
                        type: "image/png",
                        name: "screenshot.png"
                    }];
                } else {
                    output = execResult;
                }
            } else {
                // Check if MCP is enabled
                const servers = Array.isArray(request.mcpServers) ? request.mcpServers : [];
                const isMultiServer = request.enableMcpTools === true && servers.length > 0;
                const mcpEnabled = request.enableMcpTools === true && (isMultiServer || this.mcpManager.isEnabled(request));

                if (!this.mcpManager || !mcpEnabled) {
                    throw new Error(`Unknown tool '${toolName}'. (External MCP tools are disabled)`);
                }

                source = "mcp_remote";
                let remote;

                // Check if this is a multi-server tool ID (format: serverId__toolName)
                const isMultiServerTool = toolName.includes('__');

                if (isMultiServerTool && isMultiServer) {
                    // Multi-server mode: route by tool ID
                    remote = await this.mcpManager.callToolById(toolName, toolCommand.args || {}, servers);
                } else if (isMultiServer) {
                    // Multi-server but plain tool name - try to find it in any server
                    // First, check which server has this tool
                    const allTools = await this.mcpManager.listAllActiveTools(servers);
                    const matchingTool = allTools.find(t => t.name === toolName);

                    if (!matchingTool) {
                        throw new Error(`Tool '${toolName}' not found in any enabled MCP server.`);
                    }

                    // Check if tool is enabled for its server
                    const server = servers.find(s => s.id === matchingTool._serverId);
                    if (server && server.toolMode === 'selected') {
                        const enabled = Array.isArray(server.enabledTools) ? new Set(server.enabledTools) : new Set();
                        if (!enabled.has(toolName)) {
                            throw new Error(`External MCP tool '${toolName}' is disabled (not in selected tools).`);
                        }
                    }

                    remote = await this.mcpManager.callToolById(matchingTool._toolId, toolCommand.args || {}, servers);
                } else {
                    // Legacy single-server mode
                    if (request && request.mcpToolMode === 'selected') {
                        const enabled = Array.isArray(request.mcpEnabledTools) ? request.mcpEnabledTools : [];
                        const enabledSet = new Set(enabled);
                        if (!enabledSet.has(toolName)) {
                            throw new Error(`External MCP tool '${toolName}' is disabled (not in selected tools).`);
                        }
                    }
                    remote = await this.mcpManager.callTool(request, toolName, toolCommand.args || {});
                }

                output = remote.text;
                files = remote.files && remote.files.length ? remote.files : null;
            }
        } catch (err) {
            output = `Error executing tool: ${err.message}`;
            status = "failed";
        }

        this.sendToolStatus(request, {
            statusKey,
            toolName,
            status,
            toolCallText,
            callIndex,
            callCount,
            text: status === "failed" ? output : ""
        });

        return {
            id: toolCommand.id || null,
            toolName,
            args: toolCommand.args || {},
            output,
            files,
            source,
            status,
            callIndex,
            callCount
        };
    }

    formatFunctionCallText(call) {
        if (!call || typeof call.name !== 'string') return "";
        try {
            return JSON.stringify({
                tool: call.name,
                args: isPlainObject(call.args) ? call.args : {}
            }, null, 2);
        } catch (_) {
            return call.name;
        }
    }

    createToolStatusKey(request, toolName, callIndex = null, callCount = null) {
        const parts = [
            request?.sessionId || "no-session",
            toolName || "tool"
        ];
        if (Number.isFinite(callIndex) && Number.isFinite(callCount) && callCount > 1) {
            parts.push(String(callIndex));
        }
        return parts.join('|');
    }

    sendToolStatus(request, status) {
        if (!request?.sessionId) return;
        chrome.runtime.sendMessage({
            action: "TOOL_CALL_STATUS_MESSAGE",
            sessionId: request.sessionId,
            ...status
        }).catch(() => {});
    }
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}
