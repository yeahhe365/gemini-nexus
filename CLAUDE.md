# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gemini Nexus is a Chrome Extension (MV3) that deeply integrates Google Gemini AI capabilities into the browser. It provides:
- A side panel for AI conversations
- **Picture-in-Picture (PIP) floating window** - System-level floating AI assistant (Alt+G)
- A floating toolbar for quick AI actions (translate, summarize, rewrite)
- Image AI processing (OCR, screenshot translation)
- Browser control via Chrome Debugger Protocol (MCP)
- External MCP server integration

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview build
npm run preview
```

## Loading the Extension

1. Build the extension: `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder (or root directory in dev mode)

## Architecture

### Core Components

**Background Service Worker** (`background/index.js`)
- Entry point that initializes all managers
- Runs as a Chrome MV3 service worker
- Coordinates between providers, managers, and control systems

**Managers** (`background/managers/`)
- `session_manager.js` - Handles AI chat sessions and request dispatching
- `auth_manager.js` - Manages authentication for Web provider
- `image_manager.js` - Processes image uploads and transformations
- `control_manager.js` - Orchestrates browser control actions
- `mcp_remote_manager.js` - Connects to external MCP servers via WebSocket/SSE/HTTP
- `history_manager.js` - Persists conversation history
- `log_manager.js` - Captures console logs for debugging

**AI Providers** (`services/providers/`)

Three provider implementations that handle different Gemini access methods:

1. `web.js` - Web Client provider
   - Uses Google's web interface (requires login)
   - Free, supports Gemini 3 series models
   - Supports web plugins/search
   - Model IDs: `gemini-3-flash`, `gemini-3-flash-thinking`, `gemini-3-pro`

2. `official.js` - Official API provider
   - Uses Google AI Studio API (requires API key)
   - Fast response, native Thinking mode support
   - Model mapping to preview versions (e.g., `gemini-3-flash-preview`)

3. `openai_compatible.js` - OpenAI-compatible provider
   - Supports GPT, Claude, and other compatible APIs
   - Extensible for third-party services

**Browser Control (MCP)** (`background/control/`)
- `connection.js` - Manages Chrome Debugger API connection
- `actions.js` - Dispatches control actions to specialized handlers
- `collectors.js` - Collects browser state (logs, network, DOM)
- `snapshot.js` - Captures page snapshots using Accessibility Tree
- `wait_helper.js` - Waits for page events and navigation

**Control Actions** (`background/control/actions/`)
- `navigation.js` - Page navigation (`navigate_page`, `new_page`, etc.)
- `input/mouse.js` - Click, drag, scroll actions using element UIDs
- `input/keyboard.js` - Keyboard input simulation
- `observation/visual.js` - Screenshot capture (`take_snapshot`)
- `observation/script.js` - JavaScript execution (`evaluate_script`)
- `observation/network.js` - Network log retrieval (`get_logs`)

**Content Scripts** (`content/`)
- `pip.js` - Document Picture-in-Picture window manager
- `overlay.js` - Detects and handles page images
- `toolbar/` - Floating toolbar UI that appears on text selection
- `selection.js` - Handles text selection events
- `shortcuts.js` - Keyboard shortcuts
- `crop.js` - Screenshot cropping functionality

**Side Panel** (`sidepanel/`)
- Main chat interface HTML/JS
- `core/bridge.js` - Communication with background
- `core/state.js` - UI state management
- `core/frame.js` - Sandbox iframe management

**Sandbox** (`sandbox/`)
- Isolated iframe for secure Markdown/LaTeX rendering
- Uses strict CSP to prevent XSS
- Loads external libraries (Marked.js, KaTeX, Highlight.js) from CDN

**Shared Libraries** (`lib/`)
- `messaging.js` - Chrome messaging utilities
- `watermark_remover.js` - Image watermark removal algorithm
- `crop_utils.js` - Canvas image cropping utilities

### Build Configuration

**Vite Config** (`vite.config.ts`)
- Build targets: `sidepanel/index.html` and `sandbox/index.html`
- Dev server runs on port 3000
- Alias `@/` resolves to project root
- ESM module format

**Manifest** (`manifest.json`)
- Chrome Extension Manifest V3
- Permissions: sidePanel, storage, contextMenus, scripting, alarms, debugger, downloads, tabs
- Service worker: `background/index.js`
- Content scripts load at `document_end` on all URLs
- Keyboard shortcut: Alt+S to open sidebar

### Browser Control Protocol (MCP)

The extension implements an Agent-style browser automation system:

**Element Identification**
- Uses Chrome Accessibility Tree to generate stable UIDs for elements
- UIDs format: `a11y-{backendNodeId}` (e.g., `a11y-123`)
- Snapshots return simplified DOM trees with UIDs for AI to reference

**Action Flow**
1. AI takes a snapshot to see current page state
2. AI identifies target element by UID from snapshot
3. AI calls action (e.g., `click`, `fill`) with the UID
4. Extension executes via Chrome Debugger Protocol
5. WaitHelper waits for page to stabilize (network idle, DOM mutations settle)

**Available Actions**
- Navigation: `navigate_page`, `new_page`, `go_back`, `go_forward`, `reload_page`, `close_page`, `switch_page`
- Input: `click`, `fill`, `submit`, `drag`, `press_key`, `type_text`
- Observation: `take_snapshot`, `take_screenshot`, `get_logs`, `evaluate_script`
- Wait: `wait_for_navigation`, `wait_for_element`, `wait_for_text`

### External MCP Integration

The extension can connect to external MCP servers that provide additional tools:

**Supported Transports**
- WebSocket: `ws://localhost:3006/mcp`
- SSE (Server-Sent Events): `http://localhost:3006/sse`
- Streamable HTTP: `http://localhost:3006/mcp`

**Setup Flow**
1. Run local MCP proxy (e.g., MCP SuperAssistant) that exposes stdio MCP servers
2. Configure server URL in Settings → Connection → External MCP Tools
3. Enable and test connection
4. AI can now call external tools alongside built-in browser control

**Tool Execution**
- Tools are exposed to the AI model as JSON schemas
- AI outputs tool calls as JSON blocks: `{ "tool": "name", "args": {...} }`
- Extension forwards to MCP server and returns results
- Results normalized to `{ text, files }` format for consistency

## Key Implementation Details

**Message Streaming**
- All providers implement streaming responses
- Web provider parses Server-Sent Events format
- Official API uses `streamGenerateContent` endpoint
- Responses flow through `onUpdate` callback to UI

**File Upload**
- Images converted to base64 for processing
- Web provider uploads to Google's CDN
- Official API uses File API with multipart upload
- Supports multiple files per request

**Thinking Mode**
- Official API supports `thinkingLevel` parameter
- Responses include `thoughtSignature` for thought tracking
- Web provider has dedicated `gemini-3-flash-thinking` model

**Session Management**
- Conversations stored in Chrome storage
- History includes full turn-by-turn messages
- Context preserved across browser restarts
- AbortController for request cancellation

**Security**
- Sandbox iframe isolates markdown rendering from main page
- CSP prevents inline scripts in extension pages
- Chrome storage encrypted by browser
- API keys stored locally, never transmitted to third parties

## Picture-in-Picture (PIP) Window

### Overview
Uses Document Picture-in-Picture API to create a system-level floating window that stays above all applications.

### Key Features
- **Global shortcut**: Alt+G (works even when browser is not focused)
- **Always-on-top**: Floats above VSCode, Office, design tools, etc.
- **Full DOM environment**: Complete Gemini Nexus interface in PIP
- **Toggle minimize**: Press Alt+G again to minimize to 64x64px
- **Chrome 111+ only**

### Implementation
- `content/pip.js` - Core PIP logic
- `manifest.json` - Global command configuration (`global: true`)
- `background/index.js` - Command listener and state management
- `content/index.js` - Message routing to PIP module

### Usage
```javascript
// In content script context
window.GeminiPip.create()         // Create PIP window
window.GeminiPip.toggleMinimize() // Toggle size
window.GeminiPip.close()          // Close window
window.GeminiPip.isSupported()    // Check API availability
```

### Testing
See `PIP-TESTING-GUIDE.md` for detailed testing instructions.

## Common Development Tasks

**Adding a New Provider**
1. Create file in `services/providers/`
2. Export async function with signature: `(prompt, systemInstruction, history, config, files, signal, onUpdate) => Promise`
3. Implement streaming response handling
4. Add to `RequestDispatcher` in `background/managers/session/request_dispatcher.js`

**Adding a Browser Control Action**
1. Add action definition to appropriate file in `background/control/actions/`
2. Register in `background/control/actions.js` dispatcher
3. Implement CDP commands via `connection.sendCommand()`
4. Use `wait_helper.js` for post-action stability

**Modifying the UI**
- Side panel: Edit `sidepanel/index.html` and `sidepanel/core/`
- Floating toolbar: Edit `content/toolbar/` modules
- Sandbox rendering: Edit `sandbox/index.html`

**Testing Changes**
1. Make code changes
2. Run `npm run build`
3. Reload extension in `chrome://extensions/`
4. Test in browser (open side panel, select text, etc.)
5. Check console logs in background page and content script
