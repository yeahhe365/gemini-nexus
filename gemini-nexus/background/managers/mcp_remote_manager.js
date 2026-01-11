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

function asWsUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return trimmed;
}

function asHttpUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
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

    // Multi-connection support: Map<serverId, ConnectionState>
    this.connections = new Map();
    this.nextId = 1;
  }

  // Create a fresh connection state object
  _createConnectionState() {
    return {
      transport: null,
      ws: null,
      configKey: null,
      pending: new Map(),
      initialized: false,
      toolsCache: null,
      toolsCacheAt: 0,
      idleCloseTimer: null,
      sseAbort: null,
      ssePostUrl: null,
      sseReaderTask: null,
      httpPostUrl: null,
      _resolveSseEndpoint: null
    };
  }

  isEnabled(config) {
    const enabled = config && (config.enableMcpTools === true || config.mcpEnabled === true);
    return !!(enabled && config.mcpServerUrl);
  }

  // Check if multi-server mode is enabled
  isMultiEnabled(config) {
    if (!config || config.enableMcpTools !== true) return false;
    const servers = config.mcpServers;
    if (!Array.isArray(servers)) return false;
    return servers.some(s => s && s.enabled !== false && s.url && s.url.trim());
  }

  async disconnect(serverId) {
    if (serverId) {
      // Disconnect specific server
      const conn = this.connections.get(serverId);
      if (conn) {
        this._disconnectState(conn);
        this.connections.delete(serverId);
      }
    } else {
      // Disconnect all
      for (const [id, conn] of this.connections.entries()) {
        this._disconnectState(conn);
      }
      this.connections.clear();
    }
  }

  _disconnectState(conn) {
    if (conn.idleCloseTimer) {
      clearTimeout(conn.idleCloseTimer);
      conn.idleCloseTimer = null;
    }
    this._clearPending(conn, new Error('MCP connection closed'));
    conn.toolsCache = null;
    conn.toolsCacheAt = 0;
    conn.initialized = false;
    conn.configKey = null;
    conn.transport = null;

    if (conn.ws) {
      try { conn.ws.close(); } catch {}
    }
    conn.ws = null;

    if (conn.sseAbort) {
      try { conn.sseAbort.abort(); } catch {}
    }
    conn.sseAbort = null;
    conn.ssePostUrl = null;
    conn.sseReaderTask = null;
    conn.httpPostUrl = null;
  }

  _clearIdleTimer(conn) {
    if (conn.idleCloseTimer) {
      clearTimeout(conn.idleCloseTimer);
      conn.idleCloseTimer = null;
    }
  }

  _bumpIdleClose(conn, serverId) {
    this._clearIdleTimer(conn);
    conn.idleCloseTimer = setTimeout(() => {
      this.disconnect(serverId).catch(() => {});
    }, 120000);
  }

  _clearPending(conn, error) {
    for (const [id, entry] of conn.pending.entries()) {
      clearTimeout(entry.timeout);
      entry.reject(error);
      conn.pending.delete(id);
    }
  }

  async _sendRpc(conn, method, params) {
    if (conn.transport === 'streamable-http') {
      return await this._sendRpcStreamableHttp(conn, method, params);
    }

    if (conn.transport === 'ws') {
      if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
        throw new Error('MCP WebSocket not connected');
      }
    } else if (conn.transport === 'sse') {
      if (!conn.ssePostUrl) {
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
        conn.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      conn.pending.set(id, { resolve, reject, timeout });
    });

    if (conn.transport === 'ws') {
      conn.ws.send(JSON.stringify(msg));
    } else {
      fetch(conn.ssePostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(err => {
        const entry = conn.pending.get(id);
        if (entry) {
          clearTimeout(entry.timeout);
          conn.pending.delete(id);
          entry.reject(new Error(`MCP POST failed: ${err?.message || String(err)}`));
        }
      });
    }
    return p;
  }

  _sendNotification(conn, method, params) {
    const msg = { jsonrpc: '2.0', method, params: params || {} };
    if (conn.transport === 'ws') {
      if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) return;
      conn.ws.send(JSON.stringify(msg));
      return;
    }

    if (conn.transport === 'sse') {
      if (!conn.ssePostUrl) return;
      fetch(conn.ssePostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {});
      return;
    }

    if (conn.transport === 'streamable-http') {
      if (!conn.httpPostUrl) return;
      fetch(conn.httpPostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {});
    }
  }

  // Get or create connection for a server
  _getOrCreateConnection(serverId) {
    if (!this.connections.has(serverId)) {
      this.connections.set(serverId, this._createConnectionState());
    }
    return this.connections.get(serverId);
  }

  async _ensureConnectedForServer(serverId, transport, url) {
    const conn = this._getOrCreateConnection(serverId);
    const transportLower = (transport || 'sse').toLowerCase();

    if (transportLower === 'ws' || transportLower === 'websocket') {
      const wsUrl = asWsUrl(url);
      if (!wsUrl) throw new Error('Invalid MCP server URL');
      const key = `ws:${wsUrl}`;

      if (conn.ws && conn.ws.readyState === WebSocket.OPEN && conn.initialized && conn.configKey === key) {
        this._bumpIdleClose(conn, serverId);
        return conn;
      }

      this._disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'ws';

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        conn.ws = ws;
        let opened = false;

        const onOpen = () => { opened = true; resolve(); };
        const onError = () => {
          if (!opened) reject(new Error(`Failed to connect to MCP WebSocket: ${wsUrl}`));
        };
        const onClose = () => {
          const err = new Error(`MCP WebSocket closed: ${wsUrl}`);
          this._clearPending(conn, err);
          conn.ws = null;
          conn.initialized = false;
          conn.configKey = null;
          conn.transport = null;
          if (!opened) reject(err);
        };
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg && typeof msg === 'object' && msg.id !== undefined) {
              const entry = conn.pending.get(msg.id);
              if (entry) {
                clearTimeout(entry.timeout);
                conn.pending.delete(msg.id);
                if (msg.error) entry.reject(new Error(msg.error.message || 'MCP error'));
                else entry.resolve(msg.result);
              }
            }
          } catch {}
        };

        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', onClose);
        ws.addEventListener('message', onMessage);
      });

      await this._initializeHandshake(conn);
      this._bumpIdleClose(conn, serverId);
      return conn;
    }

    if (transportLower === 'sse') {
      const sseUrlStr = asHttpUrl(url);
      if (!sseUrlStr) throw new Error('Invalid MCP SSE URL');
      const key = `sse:${sseUrlStr}`;

      if (conn.transport === 'sse' && conn.initialized && conn.configKey === key && conn.ssePostUrl) {
        this._bumpIdleClose(conn, serverId);
        return conn;
      }

      this._disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'sse';

      await this._connectSse(conn, sseUrlStr);
      await this._initializeHandshake(conn);
      this._bumpIdleClose(conn, serverId);
      return conn;
    }

    if (transportLower === 'streamable-http' || transportLower === 'streamablehttp') {
      const httpUrl = asHttpUrl(url);
      if (!httpUrl) throw new Error('Invalid Streamable HTTP URL');
      const key = `streamable-http:${httpUrl}`;

      if (conn.transport === 'streamable-http' && conn.initialized && conn.configKey === key && conn.httpPostUrl) {
        this._bumpIdleClose(conn, serverId);
        return conn;
      }

      this._disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'streamable-http';
      conn.httpPostUrl = httpUrl;

      await this._initializeHandshake(conn);
      this._bumpIdleClose(conn, serverId);
      return conn;
    }

    throw new Error(`Unsupported MCP transport: ${transport}`);
  }

  // Legacy single-server compatibility
  async _ensureConnected(config) {
    if (!this.isEnabled(config)) {
      throw new Error('MCP is not enabled or server URL is missing.');
    }
    const serverId = config.mcpServerId || '_legacy_';
    return await this._ensureConnectedForServer(serverId, config.mcpTransport, config.mcpServerUrl);
  }

  async _sendRpcStreamableHttp(conn, method, params) {
    if (!conn.httpPostUrl) throw new Error('MCP Streamable HTTP not connected');

    const id = this.nextId++;
    const msg = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    const response = await fetch(conn.httpPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`MCP Streamable HTTP error (${response.status}): ${text || response.statusText}`);
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.error) throw new Error(parsed.error.message || 'MCP error');
      if (parsed && parsed.result !== undefined) return parsed.result;
      return parsed;
    } catch {
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
      return { content: [{ type: 'text', text: trimmed }] };
    }
  }

  async _connectSse(conn, sseUrlStr) {
    const sseUrl = new URL(sseUrlStr);
    const abort = new AbortController();
    conn.sseAbort = abort;
    conn.ssePostUrl = null;

    const endpointPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP SSE endpoint handshake timeout')), 10000);
      conn._resolveSseEndpoint = (url) => {
        clearTimeout(timeout);
        resolve(url);
      };
    });

    const response = await fetch(sseUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: abort.signal,
    });

    if (!response.ok) throw new Error(`MCP SSE connect failed (${response.status}): ${response.statusText}`);
    if (!response.body) throw new Error('MCP SSE response has no body');

    conn.sseReaderTask = this._readSseStream(conn, response.body.getReader(), sseUrl).catch(() => {});

    const postUrl = await endpointPromise;
    conn.ssePostUrl = postUrl;
  }

  async _readSseStream(conn, reader, baseUrl) {
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
          const url = new URL(endpoint, baseUrl).toString();
          if (!conn.ssePostUrl) {
            conn.ssePostUrl = url;
            if (conn._resolveSseEndpoint) conn._resolveSseEndpoint(url);
          }
        } catch {}
        return;
      }

      if (type === 'message' || type === 'mcp' || type === 'data') {
        try {
          const msg = JSON.parse(payload);
          if (msg && typeof msg === 'object' && msg.id !== undefined) {
            const entry = conn.pending.get(msg.id);
            if (entry) {
              clearTimeout(entry.timeout);
              conn.pending.delete(msg.id);
              if (msg.error) entry.reject(new Error(msg.error.message || 'MCP error'));
              else entry.resolve(msg.result);
            }
          }
        } catch {}
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

          if (trimmed === '') { dispatch(); continue; }
          if (trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('event:')) { eventType = trimmed.slice('event:'.length).trim() || 'message'; continue; }
          if (trimmed.startsWith('data:')) { dataLines.push(trimmed.slice('data:'.length).trimStart()); continue; }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      this._clearPending(conn, new Error('MCP SSE stream closed'));
      conn.initialized = false;
      conn.transport = null;
      conn.configKey = null;
      conn.sseAbort = null;
      conn.ssePostUrl = null;
    }
  }

  async _initializeHandshake(conn) {
    let lastError = null;
    for (const protocolVersion of DEFAULT_PROTOCOL_VERSIONS) {
      try {
        await this._sendRpc(conn, 'initialize', {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: this.clientName, version: this.clientVersion },
        });

        this._sendNotification(conn, 'notifications/initialized', {});
        conn.initialized = true;
        return;
      } catch (e) {
        lastError = e;
        await sleep(150);
      }
    }
    throw lastError || new Error('Failed to initialize MCP connection');
  }

  // List tools for a single server (legacy compatibility)
  async listTools(config) {
    const conn = await this._ensureConnected(config);

    const now = Date.now();
    if (conn.toolsCache && now - conn.toolsCacheAt < 5 * 60 * 1000) {
      return conn.toolsCache;
    }

    const result = await this._sendRpc(conn, 'tools/list', {});
    const tools = result && Array.isArray(result.tools) ? result.tools : [];
    conn.toolsCache = tools;
    conn.toolsCacheAt = now;
    return tools;
  }

  // List tools for a specific server by ID
  async listToolsForServer(serverId, transport, url) {
    const conn = await this._ensureConnectedForServer(serverId, transport, url);

    const now = Date.now();
    if (conn.toolsCache && now - conn.toolsCacheAt < 5 * 60 * 1000) {
      return conn.toolsCache;
    }

    const result = await this._sendRpc(conn, 'tools/list', {});
    const tools = result && Array.isArray(result.tools) ? result.tools : [];
    conn.toolsCache = tools;
    conn.toolsCacheAt = now;
    return tools;
  }

  // List tools from all enabled servers (multi-server mode)
  async listAllActiveTools(servers) {
    if (!Array.isArray(servers) || servers.length === 0) return [];

    const activeServers = servers.filter(s => s && s.enabled !== false && s.url && s.url.trim());
    console.log('[MCP] listAllActiveTools: activeServers count:', activeServers.length,
      activeServers.map(s => ({ id: s.id, name: s.name, url: s.url })));
    if (activeServers.length === 0) return [];

    const results = await Promise.allSettled(
      activeServers.map(async (server) => {
        console.log('[MCP] Connecting to server:', server.id, server.url);
        const tools = await this.listToolsForServer(server.id, server.transport, server.url);
        console.log('[MCP] Server', server.id, 'returned', tools.length, 'tools');
        // Tag tools with server info for routing
        return tools.map(t => ({
          ...t,
          _serverId: server.id,
          _serverName: server.name || server.url,
          // Build unique tool ID: serverId__toolName
          _toolId: `${server.id}__${t.name}`
        }));
      })
    );

    const allTools = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        console.log('[MCP] Server', activeServers[i].id, 'fulfilled with', result.value.length, 'tools');
        allTools.push(...result.value);
      } else {
        console.error('[MCP] Server', activeServers[i].id, 'failed:', result.reason);
      }
    }
    console.log('[MCP] Total tools from all servers:', allTools.length);
    return allTools;
  }

  // Call tool (legacy single-server)
  async callTool(config, toolName, args) {
    const conn = await this._ensureConnected(config);

    const result = await this._sendRpc(conn, 'tools/call', {
      name: toolName,
      arguments: args || {},
    });

    return normalizeMcpToolResult(result);
  }

  // Call tool by full tool ID (multi-server mode): serverId__toolName
  async callToolById(toolId, args, servers) {
    const sep = toolId.indexOf('__');
    if (sep === -1) {
      throw new Error(`Invalid tool ID format: ${toolId}`);
    }
    const serverId = toolId.slice(0, sep);
    const toolName = toolId.slice(sep + 2);

    const server = servers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const conn = await this._ensureConnectedForServer(serverId, server.transport, server.url);
    const result = await this._sendRpc(conn, 'tools/call', {
      name: toolName,
      arguments: args || {},
    });

    return normalizeMcpToolResult(result);
  }

  // Build preamble for multi-server mode
  async buildToolsPreamble(config) {
    const servers = config.mcpServers;
    const isMulti = this.isMultiEnabled(config);
    console.log('[MCP] buildToolsPreamble: isMulti=', isMulti, 'servers=', servers?.length);

    let allTools = [];
    if (isMulti) {
      allTools = await this.listAllActiveTools(servers);
      console.log('[MCP] buildToolsPreamble: allTools after listAllActiveTools:', allTools.length);
      // Filter by each server's toolMode/enabledTools
      const serverMap = new Map(servers.map(s => [s.id, s]));
      allTools = allTools.filter(t => {
        const srv = serverMap.get(t._serverId);
        if (!srv) return false;
        if (srv.toolMode === 'selected') {
          const enabled = Array.isArray(srv.enabledTools) ? new Set(srv.enabledTools) : new Set();
          return enabled.has(t.name);
        }
        return true;
      });
    } else {
      // Legacy single-server mode
      const tools = await this.listTools(config);
      const mode = config && config.mcpToolMode === 'selected' ? 'selected' : 'all';
      const enabled = Array.isArray(config?.mcpEnabledTools) ? config.mcpEnabledTools : [];
      const enabledSet = mode === 'selected' ? new Set(enabled) : null;
      allTools = mode === 'selected'
        ? tools.filter(t => t && typeof t.name === 'string' && enabledSet.has(t.name))
        : tools;
    }

    if (!allTools.length) return '';

    const lines = [];
    lines.push('[System: External MCP Tools Enabled]');
    lines.push('You may call external tools using the same JSON tool-call format:');
    lines.push('```json');
    lines.push('{ "tool": "tool_name", "args": { /* ... */ } }');
    lines.push('```');
    lines.push('');
    lines.push('External Tools:');

    for (const tool of allTools) {
      if (!tool || typeof tool.name !== 'string') continue;
      const desc = typeof tool.description === 'string' ? tool.description.trim() : '';
      const schema = summarizeInputSchema(tool.inputSchema);
      const suffix = schema ? ` args: ${schema}` : '';
      // Use unique tool ID for multi-server, plain name for single
      const displayName = tool._toolId || tool.name;
      lines.push(`- ${displayName}${desc ? `: ${desc}` : ''}${suffix}`);
    }

    lines.push('');
    return lines.join('\n');
  }
}
