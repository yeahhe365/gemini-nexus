// background/managers/mcp_remote_manager.js
//
// Minimal MCP client for Chrome extension Service Worker environments.
// Uses WebSocket transport and supports tools/list + tools/call.
//
// Notes:
// - We intentionally keep this dependency-free (no npm SDK) because this project
//   ships raw ESM files referenced directly by `manifest.json`.
// - The MCP server is typically provided by a local proxy (e.g. ws://localhost:3006/mcp).
// - Tool results are normalized to { text, files } for Gemini Nexus' prompt loop.

const DEFAULT_PROTOCOL_VERSIONS = ['2024-11-05', '2024-10-07', '2024-06-20'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeLocalhost(url) {
  // Chrome extensions have better CORS support for 'localhost' than '127.0.0.1'
  // Automatically convert 127.0.0.1 to localhost for compatibility
  if (!url || typeof url !== 'string') return url;
  return url.replace(/127\.0\.0\.1/g, 'localhost');
}

function asWsUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = normalizeLocalhost(url.trim());
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return trimmed;
}

function asHttpUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = normalizeLocalhost(url.trim());
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed;
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part && part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

function extractFilesFromContent(content) {
  if (!Array.isArray(content)) return [];
  const files = [];
  for (const part of content) {
    if (!part || part.type !== 'image') continue;
    const mimeType = part.mimeType || 'image/png';
    const data = part.data;
    if (typeof data !== 'string' || data.length === 0) continue;
    // Normalize to data URL so existing UI logic can reuse it.
    const base64 = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;
    files.push({
      base64,
      type: mimeType,
      name: `mcp-image-${Date.now()}.${mimeType.includes('png') ? 'png' : 'img'}`,
    });
  }
  return files;
}

function normalizeMcpToolResult(result) {
  // The MCP SDK returns { content: [...] } for tools/call.
  // Some servers may return a plain string or other object types.
  if (typeof result === 'string') return { text: result, files: [] };

  if (result && typeof result === 'object') {
    if (Array.isArray(result.content)) {
      return {
        text: extractTextFromContent(result.content),
        files: extractFilesFromContent(result.content),
      };
    }

    // Fall back to common keys
    if (typeof result.text === 'string') return { text: result.text, files: [] };
  }

  try {
    return { text: JSON.stringify(result, null, 2), files: [] };
  } catch {
    return { text: String(result), files: [] };
  }
}

function summarizeInputSchema(schema) {
  if (!schema || typeof schema !== 'object') return '';
  const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  const parts = [];
  for (const key of required) {
    const spec = props[key] && typeof props[key] === 'object' ? props[key] : {};
    const type = typeof spec.type === 'string' ? spec.type : 'any';
    parts.push(`${key}: ${type}`);
  }
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

export class McpRemoteManager {
  constructor({ clientName = 'gemini-nexus', clientVersion = '0.0.0' } = {}) {
    this.clientName = clientName;
    this.clientVersion = clientVersion;

    this.transport = null; // 'ws' | 'sse' | 'streamable-http'

    this.ws = null;
    this.configKey = null; // `${transport}:${url}`
    this.nextId = 1;
    this.pending = new Map(); // id -> { resolve, reject, timeout }
    this.initialized = false;
    this.toolsCache = null;
    this.toolsCacheAt = 0;

    this.idleCloseTimer = null;

    // SSE state
    this.sseAbort = null;
    this.ssePostUrl = null;
    this.sseReaderTask = null;

    // Streamable HTTP state
    this.httpPostUrl = null;
  }

  isEnabled(config) {
    const enabled = config && (config.enableMcpTools === true || config.mcpEnabled === true);
    return !!(enabled && config.mcpServerUrl);
  }

  async disconnect() {
    this._clearIdleTimer();
    this._clearPending(new Error('MCP connection closed'));
    this.toolsCache = null;
    this.toolsCacheAt = 0;
    this.initialized = false;
    this.configKey = null;
    this.transport = null;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.ws = null;

    if (this.sseAbort) {
      try {
        this.sseAbort.abort();
      } catch {}
    }
    this.sseAbort = null;
    this.ssePostUrl = null;
    this.sseReaderTask = null;
    this.httpPostUrl = null;
  }

  _clearIdleTimer() {
    if (this.idleCloseTimer) {
      clearTimeout(this.idleCloseTimer);
      this.idleCloseTimer = null;
    }
  }

  _bumpIdleClose() {
    this._clearIdleTimer();
    // Close after inactivity to reduce background SW churn.
    this.idleCloseTimer = setTimeout(() => {
      this.disconnect().catch(() => {});
    }, 120000);
  }

  _clearPending(error) {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timeout);
      entry.reject(error);
      this.pending.delete(id);
    }
  }

  async _sendRpc(method, params) {
    if (this.transport === 'streamable-http') {
      return await this._sendRpcStreamableHttp(method, params);
    }

    if (this.transport === 'ws') {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('MCP WebSocket not connected');
      }
    } else if (this.transport === 'sse') {
      if (!this.ssePostUrl) {
        throw new Error('MCP SSE not connected');
      }
    } else {
      throw new Error('MCP transport not connected');
    }

    const id = this.nextId++;
    const msg = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    const p = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timeout });
    });

    if (this.transport === 'ws') {
      this.ws.send(JSON.stringify(msg));
    } else {
      fetch(this.ssePostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(err => {
        const entry = this.pending.get(id);
        if (entry) {
          clearTimeout(entry.timeout);
          this.pending.delete(id);
          entry.reject(new Error(`MCP POST failed: ${err?.message || String(err)}`));
        }
      });
    }
    return p;
  }

  _sendNotification(method, params) {
    const msg = { jsonrpc: '2.0', method, params: params || {} };
    if (this.transport === 'ws') {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify(msg));
      return;
    }

    if (this.transport === 'sse') {
      if (!this.ssePostUrl) return;
      fetch(this.ssePostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {});
      return;
    }

    if (this.transport === 'streamable-http') {
      if (!this.httpPostUrl) return;
      fetch(this.httpPostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {});
    }
  }

  async _ensureConnected(config) {
    if (!this.isEnabled(config)) {
      throw new Error('MCP is not enabled or server URL is missing.');
    }

    const transport = (config.mcpTransport || 'sse').toLowerCase();

    if (transport === 'ws' || transport === 'websocket') {
      const wsUrl = asWsUrl(config.mcpServerUrl);
      if (!wsUrl) throw new Error('Invalid MCP server URL');
      const key = `ws:${wsUrl}`;

      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.initialized && this.configKey === key) {
        this._bumpIdleClose();
        return;
      }

      await this.disconnect();
      this.configKey = key;
      this.transport = 'ws';

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;
        let opened = false;

        const onOpen = () => {
          opened = true;
          resolve();
        };
        const onError = () => {
          // Chrome sometimes fires 'error' even when a 'close' will follow; prefer close handling.
          if (!opened) reject(new Error(`Failed to connect to MCP WebSocket: ${wsUrl}`));
        };
        const onClose = () => {
          const err = new Error(`MCP WebSocket closed: ${wsUrl}`);
          this._clearPending(err);
          this.ws = null;
          this.initialized = false;
          this.configKey = null;
          this.transport = null;
          if (!opened) reject(err);
        };
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            // Response
            if (msg && typeof msg === 'object' && msg.id !== undefined) {
              const entry = this.pending.get(msg.id);
              if (entry) {
                clearTimeout(entry.timeout);
                this.pending.delete(msg.id);
                if (msg.error) {
                  entry.reject(new Error(msg.error.message || 'MCP error'));
                } else {
                  entry.resolve(msg.result);
                }
              }
            }
            // Notifications are ignored for now.
          } catch {
            // Ignore non-JSON frames
          }
        };

        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', onClose);
        ws.addEventListener('message', onMessage);
      });

      await this._initializeHandshake();
      this._bumpIdleClose();
      return;
    }

    if (transport === 'sse') {
      const sseUrlStr = asHttpUrl(config.mcpServerUrl);
      if (!sseUrlStr) throw new Error('Invalid MCP SSE URL');
      const key = `sse:${sseUrlStr}`;

      if (this.transport === 'sse' && this.initialized && this.configKey === key && this.ssePostUrl) {
        this._bumpIdleClose();
        return;
      }

      await this.disconnect();
      this.configKey = key;
      this.transport = 'sse';

      await this._connectSse(sseUrlStr);
      await this._initializeHandshake();
      this._bumpIdleClose();
      return;
    }

    if (transport === 'streamable-http' || transport === 'streamablehttp') {
      const httpUrl = asHttpUrl(config.mcpServerUrl);
      if (!httpUrl) throw new Error('Invalid Streamable HTTP URL');
      const key = `streamable-http:${httpUrl}`;

      if (this.transport === 'streamable-http' && this.initialized && this.configKey === key && this.httpPostUrl) {
        this._bumpIdleClose();
        return;
      }

      await this.disconnect();
      this.configKey = key;
      this.transport = 'streamable-http';
      this.httpPostUrl = httpUrl;

      await this._initializeHandshake();
      this._bumpIdleClose();
      return;
    }

    throw new Error(`Unsupported MCP transport: ${config.mcpTransport}`);
  }

  async _sendRpcStreamableHttp(method, params) {
    if (!this.httpPostUrl) throw new Error('MCP Streamable HTTP not connected');

    const id = this.nextId++;
    const msg = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    const response = await fetch(this.httpPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`MCP Streamable HTTP error (${response.status}): ${text || response.statusText}`);
    }

    // Try JSON first (most common).
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.error) {
        throw new Error(parsed.error.message || 'MCP error');
      }
      // Some servers return { jsonrpc, id, result }
      if (parsed && parsed.result !== undefined) return parsed.result;
      return parsed;
    } catch {
      // Fallback: try to parse the last JSON object in the response.
      const trimmed = (text || '').trim();
      const lastBrace = trimmed.lastIndexOf('}');
      const firstBrace = trimmed.indexOf('{');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = trimmed.slice(firstBrace, lastBrace + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && parsed.error) throw new Error(parsed.error.message || 'MCP error');
          if (parsed && parsed.result !== undefined) return parsed.result;
          return parsed;
        } catch {}
      }

      // Last resort: treat as plain text result.
      return { content: [{ type: 'text', text: trimmed }] };
    }
  }

  async _connectSse(sseUrlStr) {
    const sseUrl = new URL(sseUrlStr);
    const abort = new AbortController();
    this.sseAbort = abort;
    this.ssePostUrl = null;

    const endpointPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP SSE endpoint handshake timeout')), 10000);
      this._resolveSseEndpoint = (url) => {
        clearTimeout(timeout);
        resolve(url);
      };
    });

    const response = await fetch(sseUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: abort.signal,
    });

    if (!response.ok) {
      throw new Error(`MCP SSE connect failed (${response.status}): ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('MCP SSE response has no body');
    }

    this.sseReaderTask = this._readSseStream(response.body.getReader(), sseUrl).catch(() => {});

    const postUrl = await endpointPromise;
    this.ssePostUrl = postUrl;
  }

  async _readSseStream(reader, baseUrl) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    let eventType = 'message';
    let dataLines = [];

    const dispatch = () => {
      const data = dataLines.join('\n');
      const type = eventType || 'message';
      eventType = 'message';
      dataLines = [];

      const payload = data.trim();
      if (!payload) return;

      if (type === 'endpoint') {
        let endpoint = payload;
        try {
          const parsed = JSON.parse(payload);
          if (parsed && typeof parsed === 'object' && typeof parsed.endpoint === 'string') {
            endpoint = parsed.endpoint;
          }
        } catch {}

        try {
          // Allow relative endpoints.
          const url = new URL(endpoint, baseUrl).toString();
          if (!this.ssePostUrl) {
            this.ssePostUrl = url;
            if (this._resolveSseEndpoint) this._resolveSseEndpoint(url);
          }
        } catch {}
        return;
      }

      if (type === 'message' || type === 'mcp' || type === 'data') {
        try {
          const msg = JSON.parse(payload);
          if (msg && typeof msg === 'object' && msg.id !== undefined) {
            const entry = this.pending.get(msg.id);
            if (entry) {
              clearTimeout(entry.timeout);
              this.pending.delete(msg.id);
              if (msg.error) entry.reject(new Error(msg.error.message || 'MCP error'));
              else entry.resolve(msg.result);
            }
          }
        } catch {
          // ignore
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);

          const trimmed = line.replace(/\r$/, '');

          // Blank line ends event
          if (trimmed === '') {
            dispatch();
            continue;
          }

          // Comment line
          if (trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('event:')) {
            eventType = trimmed.slice('event:'.length).trim() || 'message';
            continue;
          }

          if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice('data:'.length).trimStart());
            continue;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}

      const err = new Error('MCP SSE stream closed');
      this._clearPending(err);
      this.initialized = false;
      this.transport = null;
      this.configKey = null;
      this.sseAbort = null;
      this.ssePostUrl = null;
    }
  }

  async _initializeHandshake() {
    // Try a few known protocol versions for broad compatibility.
    let lastError = null;
    for (const protocolVersion of DEFAULT_PROTOCOL_VERSIONS) {
      try {
        await this._sendRpc('initialize', {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: this.clientName, version: this.clientVersion },
        });

        this._sendNotification('notifications/initialized', {});
        this.initialized = true;
        return;
      } catch (e) {
        lastError = e;
        // Small backoff in case server is still warming up
        await sleep(150);
      }
    }

    throw lastError || new Error('Failed to initialize MCP connection');
  }

  async listTools(config) {
    await this._ensureConnected(config);

    const now = Date.now();
    if (this.toolsCache && now - this.toolsCacheAt < 5 * 60 * 1000) {
      return this.toolsCache;
    }

    const result = await this._sendRpc('tools/list', {});
    const tools = result && Array.isArray(result.tools) ? result.tools : [];
    this.toolsCache = tools;
    this.toolsCacheAt = now;
    return tools;
  }

  async callTool(config, toolName, args) {
    await this._ensureConnected(config);

    const result = await this._sendRpc('tools/call', {
      name: toolName,
      arguments: args || {},
    });

    return normalizeMcpToolResult(result);
  }

  async buildToolsPreamble(config) {
    const tools = await this.listTools(config);
    if (!tools.length) return '';

    const mode = config && config.mcpToolMode === 'selected' ? 'selected' : 'all';
    const enabled = Array.isArray(config?.mcpEnabledTools) ? config.mcpEnabledTools : [];
    const enabledSet = mode === 'selected' ? new Set(enabled) : null;

    const filteredTools = mode === 'selected'
      ? tools.filter(t => t && typeof t.name === 'string' && enabledSet.has(t.name))
      : tools;

    const lines = [];
    lines.push('[System: External MCP Tools Enabled]');
    lines.push('You may call external tools using the same JSON tool-call format:');
    lines.push('```json');
    lines.push('{ "tool": "tool_name", "args": { /* ... */ } }');
    lines.push('```');
    lines.push('');
    if (mode === 'selected') {
      lines.push(`External Tools (selected):`);
    } else {
      lines.push('External Tools:');
    }

    if (mode === 'selected' && filteredTools.length === 0) {
      lines.push('- (none enabled)');
      lines.push('');
      return lines.join('\n');
    }

    for (const tool of filteredTools) {
      if (!tool || typeof tool.name !== 'string') continue;
      const desc = typeof tool.description === 'string' ? tool.description.trim() : '';
      const schema = summarizeInputSchema(tool.inputSchema);
      const suffix = schema ? ` args: ${schema}` : '';
      lines.push(`- ${tool.name}${desc ? `: ${desc}` : ''}${suffix}`);
    }

    lines.push('');
    return lines.join('\n');
  }
}
