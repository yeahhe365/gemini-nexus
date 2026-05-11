# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Release Changelog Requirements

- Before preparing a release commit, generate the release changelog from the complete difference between the remote target branch and the local release candidate.
- For the default release target, run `git fetch origin main --tags` and inspect `git log --oneline --reverse origin/main..HEAD`.
- The changelog entry must summarize every product, test, and spec change in that range, not only the current task or latest fix.
- Exclude the version-only release commit itself when deriving user-facing changes.
- Include `CHANGELOG.md` in the release commit before pushing `origin main`.
- Push order is strict: push `origin main`, confirm the release commit is still current `HEAD`, then create and push the release tag.

## Scenario: Managed Conversation Context

### 1. Scope / Trigger

- Trigger: Any change that builds model request history from saved `geminiSessions`.
- Saved chat history is a UI/storage record. Model request history is a derived transport payload and must not be treated as the same object.

### 2. Signatures

- `prepareManagedContext(request, settings, history, signal, onStatus)` returns `{ history, systemInstruction }`.
- `history` passed into providers must contain previous turns only. The current prompt is appended separately by the provider adapter.
- `session.contextSummary` stores `{ text, sourceMessageCount, updatedAt }` for one hidden compressed API history message.

### 3. Contracts

- `session.messages`: full visible transcript. Do not delete old messages just because they were compressed for API transport.
- `contextSummary.text`: content for one hidden ordinary provider history message. It is not a visible UI message and not a special system summary block.
- `contextSummary.sourceMessageCount`: count of saved history messages already represented by the hidden compressed API history message.
- Summary mode request payload: a hidden compressed history message constructed from `contextSummary.text`, followed by only messages after `sourceMessageCount`. The provider adapter still appends the current prompt separately.
- The hidden compressed message should use `role: "user"` so provider adapters treat it as normal user-side context and do not require synthetic model-turn metadata.
- Recent-turn counting means real user requests only. Exclude tool output messages, hidden compressed messages, and official Gemini function-response transport messages even when they have `role: "user"`.
- Default recent-turn retention is `DEFAULT_CONTEXT_RECENT_TURNS` from `lib/constants.js`; keep background, sandbox, and sidepanel fallback defaults aligned through that shared constant.
- When the post-compression tail after `sourceMessageCount` reaches the configured recent-turn threshold, compress the hidden message plus the full tail into one new hidden message and advance `sourceMessageCount` to the current available history length.
- Do not append tail text onto the old compressed content, and do not keep a long-term `old hidden message + already-recompressed tail` payload after recompression succeeds.
- Recent mode request payload: recent turns only, without summary.

### 4. Validation & Error Matrix

- Missing or invalid `contextSummary.sourceMessageCount` -> ignore the summary boundary and derive context from the full saved history.
- Tool output messages saved as `role: "user"` -> render and transport as tool context, but do not increment recent-turn thresholds.
- Compression generation failure -> fall back to the previous hidden compressed message plus unsummarized tail when one exists; otherwise fall back to recent turns.
- Current user message already saved in `session.messages` -> omit it from provider history and let the provider append it as the current prompt.

### 5. Good/Base/Bad Cases

- Good: The UI reopens with all old messages visible, while the API receives one hidden compressed message plus only the managed tail.
- Base: No existing compressed message means the first over-threshold request compresses old messages into one hidden message and stores `contextSummary`.
- Bad: Passing the full saved transcript to the provider after a hidden compressed message exists, counting tool outputs as user turns, appending new tail text directly to the stored compressed text, placing compressed content in a system summary block, or including the current user message both in history and as the current prompt.

### 6. Tests Required

- Assert a compressed session reuses `contextSummary.text` as one hidden provider history message without regenerating the same compressed message.
- Assert tool-output messages do not trigger compression or recent-mode truncation by themselves.
- Assert a post-compression tail that reaches the threshold is recompressed with the existing hidden message into one new hidden message.
- Assert provider history excludes the current saved user message.
- Assert reopening a session can render the summary boundary notice from stored `contextSummary`.

### 7. Wrong vs Correct

#### Wrong

```js
const history = await getHistory(request.sessionId);
sendOfficialMessage(request.text, systemInstruction, history, config, thinkingLevel, files);
```

#### Correct

```js
const history = await resolveRequestHistory(request);
const context = await prepareManagedContext(request, settings, history, signal, onStatus);
sendOfficialMessage(request.text, context.systemInstruction, context.history, config, thinkingLevel, files);
```

## Scenario: OpenAI Compatible Reasoning Effort Settings

### 1. Scope / Trigger

- Trigger: Any change that adds or modifies OpenAI-compatible provider settings which must flow from settings UI to Chrome storage, background settings, request dispatch, and `/chat/completions` payloads.
- This is a cross-layer contract. Do not update only the UI or only the provider adapter.

### 2. Signatures

- Settings UI data field: `connection.openaiThinkingLevel`.
- Chrome storage key: `geminiOpenaiThinkingLevel`.
- Background settings field: `settings.openaiThinkingLevel`.
- OpenAI provider config field: `config.reasoningEffort`.
- OpenAI request body field: `reasoning_effort`.

### 3. Contracts

- `openaiThinkingLevel` is independent from Gemini API `thinkingLevel`.
- Default value is `"low"` in UI restore, save, and background settings.
- Supported UI values are `"minimal"`, `"low"`, `"medium"`, and `"high"`.
- `sendOpenAIMessage` must omit `reasoning_effort` when `config.reasoningEffort` is absent, so legacy/direct callers remain valid.
- Normal chat requests and context summary compression requests must pass the same OpenAI thinking level through provider config.

### 4. Validation & Error Matrix

- Missing `geminiOpenaiThinkingLevel` -> restore/save/read as `"low"`.
- Empty or absent `config.reasoningEffort` -> omit `reasoning_effort` from the payload.
- Invalid provider model support for a selected effort -> let the OpenAI-compatible endpoint return its API error; do not add local per-model detection unless a task requires it.

### 5. Good/Base/Bad Cases

- Good: OpenAI settings restore `openaiThinkingLevel`, saving writes `geminiOpenaiThinkingLevel`, dispatcher passes it as `reasoningEffort`, and payload contains `reasoning_effort`.
- Base: Existing users with no stored OpenAI thinking level get `"low"` without migration code.
- Bad: Reusing Gemini `thinkingLevel` for OpenAI, storing the value under `geminiThinkingLevel`, or adding `reasoning_effort` to Gemini provider payloads.

### 6. Tests Required

- Assert saving connection settings stores `geminiOpenaiThinkingLevel` separately from `geminiThinkingLevel`.
- Assert restoring connection settings repopulates the OpenAI selector with `"low"` when unset.
- Assert OpenAI normal chat payload includes `reasoning_effort` from `settings.openaiThinkingLevel`.
- Assert OpenAI summary compression payload also passes `reasoningEffort`.
- Assert Gemini API thinking level behavior remains unchanged.

### 7. Wrong vs Correct

#### Wrong

```js
const config = {
    baseUrl: settings.openaiBaseUrl,
    apiKey: settings.openaiApiKey,
    model: targetModel,
    reasoningEffort: settings.thinkingLevel
};
```

#### Correct

```js
const config = {
    baseUrl: settings.openaiBaseUrl,
    apiKey: settings.openaiApiKey,
    model: targetModel,
    reasoningEffort: settings.openaiThinkingLevel
};
```
