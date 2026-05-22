<p align="center">
  <a href="./README.md">中文</a> | <a href="./README.en.md">English</a>
</p>

<div align="center">
  <a href="https://github.com/yeahhe365/Gemini-Nexus">
    <img src="logo.png" width="160" height="160" alt="Gemini Nexus Logo">
  </a>

# Gemini Nexus

### Give your browser a native AI layer

  <p>
    <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini">
    <img src="https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  </p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  </p>

  <p>
    <a href="README.zh-CN.md">Chinese README</a>
  </p>

---

</div>

### Project Overview

**Gemini Nexus** gives your browser a native AI layer by combining Gemini Web, the Google Gemini API, and OpenAI-compatible APIs in one Chrome extension. It is more than a side panel: the extension includes an injected floating toolbar, image and screenshot input, Chrome DevTools Protocol based browser-control tools, and optional external MCP tools for browser-native AI workflows.

### Capability Overview

Gemini Nexus currently focuses on these browser AI workflows:

- Switch among **Gemini Web**, **Gemini API**, and **OpenAI Compatible API**, with custom `Base URL`, `API Key`, and `Model IDs`.
- Use Gemini API Google Search grounding and show web sources in responses.
- Use OpenAI-compatible web search through Responses API `web_search` or Chat Completions `web_search_options`, depending on the current endpoint.
- Limit side-panel scope by tab to reduce distraction on pages where the assistant is not needed.
- Re-edit historical user messages and continue from that point; this feature is enabled for API providers only.
- Manage context with summary compression and recent-turn trimming to reduce the risk of exceeding model context limits.
- Mark browser-control tasks with Chrome native tab groups and keep `list_pages` / `select_page` focused on the controlled scope.
- Open external links in new browser tabs to avoid failed third-party loading inside the side panel.
- Preserve settings as much as possible across extension identity and local upgrade paths.

### Provider Comparison

The project includes three provider drivers under `services/providers` and adapts behavior dynamically in code:

| Provider              | Entry                  | Models                             | Strength                                                                             | Requirement                     |
| :-------------------- | :--------------------- | :--------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------ |
| **Web Client**        | `web.js`               | Gemini 3 and image preview models  | No API key; reuses the Gemini web session                                            | Keep a Google account signed in |
| **Official API**      | `official.js`          | Gemini Flash/Pro preview models    | Fast responses with **Thinking** and Google Search grounding                         | Google AI Studio key            |
| **OpenAI Compatible** | `openai_compatible.js` | GPT, Claude, and compatible models | Highly extensible; supports Chat Completions / Responses API and optional web search | Third-party service key         |

### Browser Control

Built on `background/control/` and Chrome DevTools Protocol, Gemini Nexus lets AI perform agentic browser tasks through a local tool loop:

| Category         | Core commands                                                          | Implementation                                                                                 |
| :--------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| Navigation       | `navigate_page`, `new_page`, `close_page`, `list_pages`, `select_page` | Manages page lifecycle through `chrome.tabs`                                                   |
| Interaction      | `click`, `hover`, `fill`, `fill_form`, `press_key`, `type_text`        | Uses Accessibility Tree UIDs for precise actions, hover, batch form fill, shortcuts, and input |
| Observation      | `take_snapshot`, `wait_for`, `handle_dialog`                           | Extracts reusable accessibility-tree UIDs, waits for target text, and handles blocking dialogs |
| Script execution | `evaluate_script`                                                      | Runs custom JavaScript in the page context                                                     |

After browser control is enabled, Gemini Nexus locks onto a target tab and uses a Chrome native tab group to show the current task title. `select_page` switches inside the controlled tab group by default; regular `new_page` tabs join the group, while `background: true` opens a separate popup window to reduce focus interruption.

### External MCP Tools

Gemini Nexus can connect to one or more external MCP servers through **SSE**, **streamable HTTP**, or **WebSocket**, then expose their tools to the existing tool loop.

#### Recommended Setup: Local Proxy for stdio Servers

Chrome extensions cannot directly run stdio-based MCP servers, so the recommended setup is to run a local proxy, such as [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) Proxy. Configure your MCP servers, including stdio servers, in the proxy, then connect Gemini Nexus to the proxy endpoint.

Common proxy endpoints:

- **SSE**: `http://127.0.0.1:3006/sse`
- **Streamable HTTP**: `http://127.0.0.1:3006/mcp`
- **WebSocket**: `ws://127.0.0.1:3006/mcp`

#### Setup Steps

1. Start your MCP proxy and configure MCP servers inside it.
2. In **Settings → Connection → External MCP Tools**:
    - Enable **External MCP Tools**.
    - Add or select a server entry. **Active Server** means the entry currently being edited; conversations use all enabled servers.
    - Choose the transport and set the server URL: SSE, streamable HTTP, or WebSocket.
    - Use SSE or streamable HTTP if you need custom request headers; browser-extension WebSocket transport does not support custom headers.
    - Click **Test Connection** and **Refresh Tools**.
3. Optional, and recommended when many tools exist: set **Expose Tools** to **Selected tools only**, then enable only the tools you want the model to see or use.
4. Start a normal conversation. When the model needs tools, it outputs a JSON tool block like the one below. In multi-server mode, the model may use unique tool names in the `serverId__toolName` format to route calls to a specific server:

    ```json
    { "tool": "tool_name", "args": { "key": "value" } }
    ```

### Key Features

- **Smart side panel**: Built on the `sidePanel` API for fast conversation access and full-text history search.
- **Selection toolbar**: Injected content scripts let selected text be translated, summarized, explained, grammar-fixed, or inserted back into forms.
- **Image and screenshot input**:
    - **OCR and screenshot translation**: Canvas cropping extracts and translates selected image regions.
    - **Screen or window capture**: The side panel can use `display-capture` to select another screen or app window as image input.
    - **Floating image detection**: Detects page images and shows a floating AI analysis button.
    - **Generated image display optimization**: Uses `watermark_remover.js` in the display pipeline.
- **Safe rendering**: Markdown, LaTeX, and code blocks render inside the isolated `sandbox` environment.

### Quick Start

#### Repository Structure

The repository root is the runnable Chrome extension project root. `package.json`, `manifest.json`, Vite config, source code, tests, and packaging scripts all live at the root. Cross-runtime shared utilities live in `shared/` and are grouped by capability under `shared/attachments/`, `shared/config/`, `shared/dom/`, `shared/logging/`, `shared/mcp/`, `shared/media/`, `shared/messaging/`, `shared/models/`, `shared/settings/`, `shared/text/`, `shared/ui/`, and `shared/utils/`; the project no longer keeps top-level `shared/*.js` compatibility entry points. Directory aggregation entry points consistently use an `index.js` inside the directory to avoid sibling `foo.js` and `foo/` modules. Runtime entry points remain at each runtime root, such as `background/index.js`, `content/index.js`, `sandbox/index.js`, `sidepanel/index.js`, and the standalone settings page `settings/index.js`. Runtime code uses `snake_case` filenames, while repository tooling scripts and workflow files may use `kebab-case`.

#### Install from Release

1. Download the latest ZIP from [Releases](https://github.com/yeahhe365/Gemini-Nexus/releases) and unzip it.
2. Open `chrome://extensions/` in Chrome and enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the extracted folder.

#### Build and Package from Source

```bash
npm install
npm run package:extension
```

After packaging, choose `artifacts/chrome-extension` when using Chrome **Load unpacked**. For development, you can also load the repository root directly, but releases and manual installs should use the packaged directory. `npm run build` only creates the Vite UI output in `dist/`; it is not a complete extension directory. The package step merges multiple content scripts into a single `content/index.js` in `manifest.json` order and rewrites the packaged manifest, avoiding reliance on a long manual script list in release artifacts.

#### Publish to Chrome Web Store

Chrome Web Store credentials should stay on your local machine and must not be committed:

```bash
cp .env.chrome-webstore.example .env.chrome-webstore
```

Edit `.env.chrome-webstore` and fill in `CHROME_WEBSTORE_PUBLISHER_ID`, `CHROME_WEBSTORE_ITEM_ID`, and `CHROME_WEBSTORE_ACCESS_TOKEN` with the `https://www.googleapis.com/auth/chromewebstore` scope. After preparing the ZIP, run:

```bash
npm run publish:chrome-webstore
```

The script uploads the ZIP pointed to by `CHROME_WEBSTORE_ZIP_PATH` through Chrome Web Store API v2, then submits it for review.

### Tech Stack

- **Build tools**: Vite + TypeScript
- **Architecture protocols**: Chrome MV3 + Chrome DevTools Protocol + local/external MCP tool calls
- **Core libraries**: Marked.js, KaTeX, Highlight.js, Fuse.js

### License

This project is open sourced under the **MIT License**.

### Acknowledgements

This project has been shared in the [LINUX DO community](https://linux.do). Thanks to the community for support and feedback.
