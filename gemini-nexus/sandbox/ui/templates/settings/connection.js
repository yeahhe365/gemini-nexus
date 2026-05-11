
export const ConnectionSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="connection">Connection</h4>
    
    <div style="margin-bottom: 12px;">
        <label data-i18n="connectionProvider" style="font-weight: 500; display: block; margin-bottom: 6px;">Model Provider</label>
        <select id="provider-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 8px 12px;">
            <option value="web" data-i18n="providerWeb">Gemini Web Client (Free)</option>
            <option value="official" data-i18n="providerOfficial">Google Gemini API</option>
            <option value="openai" data-i18n="providerOpenAI">OpenAI Compatible API</option>
        </select>
    </div>
    
    <div id="api-key-container" style="display: none; flex-direction: column; gap: 12px; margin-bottom: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
        <!-- Official API Fields -->
        <div id="official-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="baseUrl" style="font-weight: 500; display: block; margin-bottom: 2px;">Base URL</label>
                <input type="text" id="official-base-url" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="officialBaseUrlPlaceholder" placeholder="https://generativelanguage.googleapis.com/v1beta">
            </div>
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="api-key-input" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Paste your Gemini API Key">
            </div>
            <div>
                <label data-i18n="modelIds" style="font-weight: 500; display: block; margin-bottom: 2px;">Model IDs</label>
                <input type="text" id="official-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="officialModelPlaceholder" placeholder="gemini-3-flash-preview, gemini-3-pro-preview">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Thinking Level (Gemini 3)</label>
                <select id="thinking-level-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                    <option value="minimal">Minimal (Flash Only)</option>
                    <option value="low">Low (Faster)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Deep Reasoning)</option>
                </select>
            </div>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="official-web-search-enabled" />
                <span data-i18n="officialWebSearch">Enable Google Search grounding</span>
            </label>
        </div>

        <!-- OpenAI Fields -->
        <div id="openai-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="baseUrl" style="font-weight: 500; display: block; margin-bottom: 2px;">Base URL</label>
                <input type="text" id="openai-base-url" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="baseUrlPlaceholder" placeholder="https://api.openai.com/v1">
            </div>
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="openai-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="sk-...">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Model IDs (Comma separated)</label>
                <input type="text" id="openai-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="e.g. gpt-4o, claude-3-5-sonnet">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Thinking Level</label>
                <select id="openai-thinking-level-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="openai-use-responses-api" />
                    <span data-i18n="openaiUseResponsesApi">Use Responses API</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="openai-web-search-enabled" />
                    <span data-i18n="openaiWebSearch">Enable OpenAI API web search</span>
                </label>
            </div>
        </div>
    </div>

    <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
                <label data-i18n="mcpTools" style="font-weight: 500; display: block; margin-bottom: 2px;">External MCP Tools</label>
                <div data-i18n="mcpToolsDesc" style="font-size: 12px; opacity: 0.85;">Connect to a local/remote MCP server and use its tools in chat.</div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="mcp-enabled" />
                <span data-i18n="enabled">Enabled</span>
            </label>
        </div>

        <div id="mcp-fields" style="display: none; flex-direction: column; gap: 12px; margin-top: 12px;">
            <div>
                <label data-i18n="mcpActiveServer" style="font-weight: 500; display: block; margin-bottom: 6px;">Active Server</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="mcp-server-select" class="shortcut-input" style="flex: 1; text-align: left; padding: 6px 12px;"></select>
                    <button id="mcp-add-server" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpAddServer">Add</button>
                    <button id="mcp-remove-server" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpRemoveServer">Remove</button>
                </div>
            </div>

            <div>
                <label data-i18n="mcpServerName" style="font-weight: 500; display: block; margin-bottom: 2px;">Name</label>
                <input type="text" id="mcp-server-name" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="Local Proxy">
            </div>
            <div>
                <label data-i18n="mcpTransport" style="font-weight: 500; display: block; margin-bottom: 2px;">Transport</label>
                <select id="mcp-transport" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                    <option value="sse">SSE (http://.../sse)</option>
                    <option value="streamable-http">Streamable HTTP (http://.../mcp)</option>
                    <option value="ws">WebSocket (ws://)</option>
                </select>
            </div>
            <div>
                <label data-i18n="mcpServerUrl" style="font-weight: 500; display: block; margin-bottom: 2px;">Server URL</label>
                <input type="text" id="mcp-server-url" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="http://127.0.0.1:3006/sse">
            </div>
            <div>
                <label data-i18n="mcpHeaders" style="font-weight: 500; display: block; margin-bottom: 2px;">Request Headers (JSON)</label>
                <textarea id="mcp-headers" class="shortcut-input" style="width: 100%; min-height: 74px; resize: vertical; text-align: left; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; line-height: 1.4;" data-i18n-placeholder="mcpHeadersPlaceholder" placeholder='{"Authorization":"Bearer xxx"}'></textarea>
                <div data-i18n="mcpHeadersDesc" style="font-size: 11px; opacity: 0.75; margin-top: 4px;">Optional JSON object. Applied to SSE and Streamable HTTP requests.</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="mcp-server-enabled" />
                    <span data-i18n="enabled">Enabled</span>
                </label>
                <button id="mcp-test-connection" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpTestConnection">Test</button>
            </div>
            <div id="mcp-test-status" style="font-size: 12px; opacity: 0.85;"></div>

            <div style="margin-top: 6px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 10px;">
                <div>
                    <label data-i18n="mcpToolMode" style="font-weight: 500; display: block; margin-bottom: 6px;">Expose Tools</label>
                    <select id="mcp-tool-mode" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                        <option value="all" data-i18n="mcpToolModeAll">All tools (default)</option>
                        <option value="selected" data-i18n="mcpToolModeSelected">Selected tools only</option>
                    </select>
                </div>

                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="mcp-refresh-tools" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpRefreshTools">Refresh Tools</button>
                    <button id="mcp-enable-all-tools" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpEnableAllTools">Enable All</button>
                    <button id="mcp-disable-all-tools" class="tool-btn" style="padding: 6px 10px;" type="button" data-i18n="mcpDisableAllTools">Disable All</button>
                </div>

                <input type="text" id="mcp-tool-search" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="mcpToolSearchPlaceholder" placeholder="Search tools...">

                <div id="mcp-tools-summary" style="font-size: 12px; opacity: 0.85;"></div>

                <div id="mcp-tool-list" style="max-height: 220px; overflow: auto; padding: 8px; background: rgba(255,255,255,0.55); border-radius: 8px; border: 1px solid rgba(0,0,0,0.06);"></div>
            </div>
        </div>
    </div>
</div>`;
