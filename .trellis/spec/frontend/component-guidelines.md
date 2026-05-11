# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

This project uses native DOM rendering modules rather than a component framework for the sandbox chat UI.

### Convention: Render Controllers for Streamed Message UI

**What**: DOM render helpers that create streamed UI must return a small controller object for later updates.

**Why**: Streaming messages receive text, thoughts, sources, and images at different times. Keeping update behavior inside the render module prevents controller code from duplicating DOM queries or knowing markup details.

**Example**:

```javascript
const bubble = appendMessage(historyDiv, "", "ai", null, "", null, {
    isStreaming: true
});

bubble.update(nextText, nextThoughts, { isStreaming: true });
bubble.finalize(finalText, finalThoughts);
bubble.addSources(sources);
bubble.addImages(images);
```

**Contract**:
- `update(text, thoughts, { isStreaming: true })` updates the existing message nodes and must not create duplicate streamed sections.
- `finalize(text, thoughts)` applies final streamed state such as completed labels, elapsed duration, and auto-collapse behavior.
- Restored history messages call `appendMessage()` without streaming options and must not briefly enter streaming UI states.

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

Use shared CSS files and existing CSS variables. Do not add frontend runtime styling libraries for isolated sandbox UI changes.

### Pattern: Research Mature UI Interaction Patterns Before Tuning

**What**: Before changing mature interaction patterns such as chat auto-scroll, sticky-to-bottom streaming, virtualized lists, drag/resize, focus management, or animation performance, inspect established implementations or official platform guidance first.

**Why**: These behaviors have edge cases that are easy to miss by guessing, especially around user intent. For example, streaming chat should usually maintain a sticky-to-bottom state while the user remains near the bottom, use content-size observation to follow streamed growth, and stop following after the user scrolls away.

**Contract**:
- Prefer official browser APIs and documented patterns first, such as `scrollTo`, `scrollIntoView`, `MutationObserver`, `ResizeObserver`, and `IntersectionObserver`.
- For app-level behavior, compare at least one mature implementation or library pattern before changing logic.
- Preserve user intent: automatic following is allowed only while the user has not explicitly moved away from the followed region.
- Record the implementation principle in the task notes or final summary when the behavior is subtle.

### Pattern: Lightweight Thinking / Reasoning Blocks

**Problem**: Reasoning content is streamed separately from the final answer and should be inspectable without dominating the message.

**Solution**: Render thoughts as a lightweight collapsible block above the AI response:
- Use a native `<button>` trigger with `aria-expanded` and `aria-controls`.
- Expand automatically while thoughts are streaming.
- Collapse automatically on final reply and show elapsed seconds when available.
- Hide the block for empty or whitespace-only thoughts.
- Style with low-contrast text and a left border instead of a card container.

**Why**: This matches the current AI chat UX pattern while keeping implementation native to the extension.

---

## Accessibility

- Interactive disclosure controls must be buttons, not clickable `<div>` elements.
- Disclosure triggers must keep `aria-expanded` and `aria-controls` in sync with the content region.
- Hidden disclosure content should use the `hidden` attribute so keyboard and screen-reader behavior matches visual state.

---

## Common Mistakes

- Treating whitespace-only streamed fields as displayable content. Trim before deciding whether optional regions should be visible.
- Starting elapsed time when an empty streaming bubble is created. For optional streamed sections, start timing when the first displayable content for that section arrives.
- Letting restored history messages reuse live streaming options. History render paths should default to stable, collapsed completed state.

## Scenario: Tool Call Message Rendering Contract

### 1. Scope / Trigger

- Trigger: Any change that renders browser-control or MCP tool calls, tool output, Gemini native function calls, or restored tool history.
- Tool call UI is a cross-layer contract: provider responses are parsed in the background, tool status/output is emitted over runtime messages, messages are persisted in session storage, and sandbox render helpers produce the visible disclosure UI.

### 2. Signatures

- Runtime status message: `{ action: "TOOL_CALL_STATUS_MESSAGE", sessionId, statusKey, toolName, status, toolCallText, callIndex?, callCount?, text? }`.
- Runtime output message: `{ action: "TOOL_OUTPUT_MESSAGE", sessionId, toolName, text, images?, toolCallText?, status, step?, callIndex?, callCount? }`.
- Stored tool output message metadata: `{ kind: "tool-output", toolName, toolStatus, toolCallText, toolStep, toolCallIndex?, toolCallCount? }`.
- Render options for `appendMessage(...)`: `{ kind: "tool-output" | "tool-status", toolName, toolStatus, toolCallText, step, callIndex?, callCount?, isCollapsed? }`.

### 3. Contracts

- A raw tool call must render inside the tool disclosure, not as a standalone assistant message.
- Tool output must render as a collapsed disclosure by default. It may show a short preview, but full args/output belong in the disclosure body.
- `step` represents the current tool loop round. It must not be incremented for multiple tool calls returned in the same model response.
- `callIndex` and `callCount` identify multiple tool calls in the same response. They must be persisted and restored so reopened sessions keep the same metadata.
- Tool status/output keys must include `callIndex` when `callCount > 1` to avoid same-name tool calls overwriting each other.
- Thinking-only assistant messages and adjacent tool disclosures should use explicit render classes for compact spacing. Do not depend on `:has()` selectors or negative margins for this relationship.
- Tool-call protocol JSON parsing must go through the shared `lib/tool_call_text.js` helpers. Do not maintain separate background and sandbox regex parsers for the same stream text.
- `toolCallText` passed to disclosure rendering must be normalized JSON object text without markdown fences. The disclosure renderer owns re-wrapping it for display.
- Streaming assistant text should hide plausible in-progress tool-call prefixes only within a short uncertainty budget before the JSON object is complete. If the partial JSON later proves not to be a tool call, or stays ambiguous past the budget, it should become visible as ordinary assistant content.
- Once a partial object has confirmed the tool protocol shape (`tool` plus `args`), keep it out of assistant markdown until the tool disclosure owns the display.
- Empty fenced code blocks must not render code-block chrome such as copy buttons. Markdown code rendering should return no wrapper for whitespace-only code content.

### 4. Validation & Error Matrix

- Empty or whitespace-only tool call text -> omit the raw call block, keep the output disclosure.
- Missing `callIndex` / `callCount` -> render as a single-call tool output and omit the call counter.
- Same tool name appears multiple times in one response -> status/output keys must remain distinct.
- Restored legacy messages without metadata -> recover `toolName` and `step` from the saved `[Tool Output: ...]` text when possible.
- Adjacent or malformed fences around consumed tool-call JSON, such as ``````json between calls, -> strip the consumed tool-call sequence from assistant markdown and keep only the final prose visible.
- Early stream chunks like ```json, ```json followed by `{`, or a partial `{"tool": ...` object -> keep assistant markdown empty only while they remain within the uncertainty budget, instead of flashing a normal JSON code block.
- Long ambiguous JSON/code blocks without a confirmed tool protocol shape -> release to assistant markdown so normal long-code streaming is not delayed until generation finishes.
- Empty or whitespace-only fenced code blocks -> render nothing, not a copy-only code block.

### 5. Good/Base/Bad Cases

- Good: A Gemini response with two `functionCall` parts creates two tool disclosures with the same `step` and `Call 1/2`, `Call 2/2` metadata.
- Base: A text-based tool command creates one status disclosure and one output disclosure without a call counter.
- Bad: Raw `{"tool": ...}` JSON appears as normal assistant markdown, tool output replaces the thinking block, or the same-name second tool call reuses the first status block.
- Bad: The sandbox keeps its own tool-call splitting regex and leaves an opening ```json marker in the visible assistant stream after the background already executed the tool.

### 6. Tests Required

- Assert native multi-call responses preserve one loop `step` while assigning sequential `callIndex` values.
- Assert runtime status/output keys differ for same-name multi-call tools.
- Assert restored tool-output messages pass `toolCallIndex` and `toolCallCount` back into `appendMessage`.
- Assert thinking-only and tool disclosures receive compact spacing classes without relying on CSS `:has()`.
- Assert adjacent/malformed fenced tool-call blocks are stripped from streamed assistant markdown while final prose remains visible.
- Assert streaming-only partial tool-call prefixes do not render as normal code blocks, non-tool JSON prefixes become visible once they no longer match the tool-call shape, and long ambiguous prefixes are released before generation finishes.
- Assert empty fenced code blocks do not produce `.copy-code-btn` or code-block wrappers.

### 7. Wrong vs Correct

#### Wrong

```javascript
const step = loopCount + index + 1;
meta.textContent = `Raw tool: ${toolName} · Next step ${step}`;
```

#### Correct

```javascript
const step = loopCount;
const callIndex = index + 1;
meta.textContent = `Raw tool: ${toolName} · Step ${step} · Call ${callIndex}/${callCount}`;
```

## Scenario: Storage-Driven Current Session Refresh

### 1. Scope / Trigger

- Trigger: Any change that saves chat messages in background storage and broadcasts updated sessions back to the sandbox UI.
- This is a cross-layer UI freshness contract: background history persistence emits `SESSIONS_UPDATED`, sidepanel bridge forwards `RESTORE_SESSIONS`, and sandbox controllers must keep both the session list and the currently visible transcript in sync.

### 2. Signatures

- Background runtime message: `{ action: "SESSIONS_UPDATED", sessions }`.
- Sidepanel iframe message: `{ action: "RESTORE_SESSIONS", payload: sessions }`.
- Current-session refresh helper: `syncCurrentSessionFromStorage(sessionId, previousMessageCount)`.
- Duplicate-render guard: `markSessionRenderedFromStorage(sessionId, messageCount)`.

### 3. Contracts

- `RESTORE_SESSIONS` must update `SessionManager` from the provided session list and refresh the sidebar history list.
- If the current session still exists and storage added a new AI message, the sandbox must rerender that current session immediately. Users must not need to manually switch sessions to see the final reply.
- A storage-driven rerender must mark the session/message count as already rendered so the later `GEMINI_REPLY` fallback path does not append the same final reply again.
- Do not rerender draft state or unrelated sessions just because storage changed.
- Streaming UI remains authoritative while streaming updates are arriving; storage refresh is the fallback that guarantees the final persisted transcript becomes visible.

### 4. Validation & Error Matrix

- `RESTORE_SESSIONS` adds an AI message to the current session -> rerender current transcript and mark it storage-rendered.
- `RESTORE_SESSIONS` only changes unrelated sessions -> refresh sidebar only.
- Current session was removed or filtered as blank -> apply normal restore/draft behavior.
- `GEMINI_REPLY` arrives after the same AI reply was storage-rendered -> update session context/state, but do not append duplicate UI content.

### 5. Good/Base/Bad Cases

- Good: User sends from draft, background persists the final AI reply, `SESSIONS_UPDATED` arrives, and the current chat shows the reply without manual session switching.
- Base: A sidebar-only update for another session updates the history list without disrupting the visible transcript.
- Bad: Final reply exists in storage but visible chat stays stale until manual switch, or storage refresh rerenders and `GEMINI_REPLY` appends a duplicate reply.

### 6. Tests Required

- Assert current chat rerenders when `RESTORE_SESSIONS` adds an AI reply to the current session.
- Assert storage-rendered final replies are not appended again by `handleGeminiReply`.
- Assert unrelated session updates do not force a current transcript rerender.

### 7. Wrong vs Correct

#### Wrong

```javascript
this.sessionManager.setSessions(restoredSessions);
this.sessionFlow.refreshHistoryUI();
```

#### Correct

```javascript
const previousCurrentId = this.sessionManager.currentSessionId;
const previousMessageCount = this.getMessageCount(this.sessionManager.getCurrentSession());

this.sessionManager.setSessions(restoredSessions);
this.sessionFlow.refreshHistoryUI();
this.syncCurrentSessionFromStorage(previousCurrentId, previousMessageCount);
```

## Scenario: Side Panel Tab Ownership

### 1. Scope / Trigger

- Trigger: Any change that opens the Chrome side panel, forwards sandbox messages to the background, filters runtime messages by tab, or binds a side panel to a session.
- This is a cross-layer ownership contract: background side panel options define the owner tab, sidepanel state holds that owner tab, bridge messages attach `sidePanelTabId`, and sandbox session bindings use that tab id.

### 2. Signatures

- Tab-scoped panel path: `sidepanel/index.html?tabId=<positive integer>`.
- Sidepanel current-tab context: `{ action: "RESTORE_SIDE_PANEL_TAB_CONTEXT", payload: { tabId, sessionId } }`.
- Background forwarding field: `{ sidePanelTabId }`.
- Runtime message filter field: `{ tabId }`.

### 3. Contracts

- A tab-scoped side panel must use the tab id from its own URL as the fixed owner tab. It must not follow `chrome.tabs.onActivated` once an owner tab exists.
- Background code that enables or opens a tab-specific side panel must call the shared path builder so the page receives `?tabId=...`.
- `sidePanelTabId` must represent the side panel owner tab, not the globally active tab at send time.
- Runtime messages containing `tabId` must be matched against the side panel owner tab. Messages without `tabId` remain broadcast messages.
- The active-tab fallback is only for unscoped side panel pages such as the full-page sidepanel URL.

### 4. Validation & Error Matrix

- Multiple tabs each have an open side panel -> each side panel keeps its own owner tab after tab activation changes.
- User sends a message from a non-active tab's side panel -> forwarded background request carries that side panel's owner tab id.
- Background replies with `{ tabId: ownerTabId }` -> only the matching side panel processes the message.
- Background broadcasts `SESSIONS_UPDATED` without `tabId` -> all side panels receive storage refresh and their sandbox refresh logic decides whether the current transcript changed.
- Legacy or full-page sidepanel URL without `tabId` -> continue using active-tab tracking.

### 5. Good/Base/Bad Cases

- Good: Tab A and Tab B both have side panels. Activating Tab B does not change Tab A's `currentTabId`; sending from Tab A still uses Tab A's id and refreshes Tab A's chat.
- Base: A full-page sidepanel opened from `OPEN_FULL_PAGE` has no owner tab and follows the active tab as before.
- Bad: Every open side panel rewrites its context to the latest active tab, causing messages or final replies to be filtered into the wrong side panel.

### 6. Tests Required

- Assert the side panel path builder emits `sidepanel/index.html?tabId=<id>` for positive tab ids.
- Assert tab-scoped side panels ignore `chrome.tabs.onActivated` and keep the URL owner tab id.
- Assert unscoped side panel pages still use active-tab tracking.

### 7. Wrong vs Correct

#### Wrong

```javascript
chrome.tabs.onActivated.addListener(({ tabId }) => {
    this.currentTabId = tabId;
});
```

#### Correct

```javascript
chrome.tabs.onActivated.addListener(({ tabId }) => {
    if (this.hasFixedTabContext()) return;
    this.currentTabId = tabId || null;
});
```
