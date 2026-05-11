
// sandbox/controllers/message_handler.js
import { appendContextCompressionNotice, appendMessage } from '../render/message.js';
import { cropImage } from '../../lib/crop_utils.js';
import {
    isToolCallOnlyText,
    splitToolCallFromText
} from '../../lib/tool_call_text.js';
import { t } from '../core/i18n.js';
import { WatermarkRemover } from '../../lib/watermark_remover.js';

function hasDisplayableThoughts(thoughts) {
    return typeof thoughts === 'string' ? thoughts.trim().length > 0 : Boolean(thoughts);
}

function hasDisplayableText(text) {
    return typeof text === 'string' ? text.trim().length > 0 : Boolean(text);
}

export class MessageHandler {
    constructor(sessionManager, uiController, imageManager, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        this.app = appController; // Reference back to app for state like captureMode
        this.streamingBubble = null;
        this.contextCompressionNotice = null;
        this.streamStates = new Map();
        this.storageRenderedMessageCounts = new Map();
    }

    async handle(request) {
        // MCP server test result
        if (request.action === "MCP_TEST_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpTestResult === 'function') {
                this.ui.settings.updateMcpTestResult(request);
            }
            return;
        }

        if (request.action === "MCP_TOOLS_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpToolsResult === 'function') {
                this.ui.settings.updateMcpToolsResult(request);
            }
            return;
        }

        // 0. Stream Update
        if (request.action === "GEMINI_STREAM_UPDATE") {
            this.handleStreamUpdate(request);
            return;
        }

        if (request.action === "GEMINI_CONTEXT_STATUS") {
            this.handleContextStatus(request);
            return;
        }

        // 1. AI Reply
        if (request.action === "GEMINI_REPLY") {
            this.handleGeminiReply(request);
            return;
        }

        if (request.action === "TOOL_OUTPUT_MESSAGE") {
            this.handleToolOutputMessage(request);
            return;
        }

        if (request.action === "TOOL_CALL_STATUS_MESSAGE") {
            this.handleToolCallStatusMessage(request);
            return;
        }

        // 2. Image Fetch Result (For User Uploads)
        if (request.action === "FETCH_IMAGE_RESULT") {
            this.handleImageResult(request);
            return;
        }

        // 2.1 Generated Image Result (Proxy Fetch for Display)
        if (request.action === "GENERATED_IMAGE_RESULT") {
            await this.handleGeneratedImageResult(request);
            return;
        }

        // 3. Capture Result (Crop & OCR)
        if (request.action === "CROP_SCREENSHOT") {
            await this.handleCropResult(request);
            return;
        }

        // 4. Mode Sync (from Context Menu)
        if (request.action === "SET_SIDEBAR_CAPTURE_MODE") {
            this.app.setCaptureMode(request.mode);
            let statusText = t('selectSnip');
            if (request.mode === 'ocr') statusText = t('selectOcr');
            if (request.mode === 'screenshot_translate') statusText = t('selectTranslate');
            
            this.ui.updateStatus(statusText);
            return;
        }

        // 5. Quote Selection Result
        if (request.action === "SELECTION_RESULT") {
            this.handleSelectionResult(request);
            return;
        }

        // 6. Page Context Toggle (from Context Menu)
        if (request.action === "TOGGLE_PAGE_CONTEXT") {
            this.app.setPageContext(request.enable);
            return;
        }
    }

    isCurrentSessionMessage(request) {
        const currentSessionId = this.sessionManager.currentSessionId || null;
        const messageSessionId = request.sessionId || null;
        return currentSessionId !== null && messageSessionId === currentSessionId;
    }

    isGeneratingSessionMessage(request) {
        const generatingSessionId = this.app.generatingSessionId || null;
        const messageSessionId = request.sessionId || null;
        return generatingSessionId !== null && messageSessionId === generatingSessionId;
    }

    hasPersistedAiReply(session, request) {
        if (!session || !Array.isArray(session.messages) || session.messages.length === 0) {
            return false;
        }

        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'ai') return false;

        const expectedText = request.text || "";
        const actualText = lastMessage.text || "";
        const textMatches = expectedText
            ? actualText === expectedText || actualText.startsWith(expectedText)
            : actualText.length > 0;
        if (!textMatches) return false;

        if (request.thoughts) {
            const actualThoughts = lastMessage.thoughts || "";
            return actualThoughts === request.thoughts || actualThoughts.startsWith(request.thoughts);
        }

        return true;
    }

    markSessionRenderedFromStorage(sessionId, messageCount) {
        if (!sessionId || !Number.isInteger(messageCount)) return;
        this.storageRenderedMessageCounts.set(sessionId, messageCount);
    }

    hasStorageRenderedAiReply(session, request) {
        if (!session || !session.id) return false;
        const renderedCount = this.storageRenderedMessageCounts.get(session.id);
        if (!Number.isInteger(renderedCount)) return false;
        if (!Array.isArray(session.messages) || renderedCount < session.messages.length) return false;
        return this.hasPersistedAiReply(session, request);
    }

    getRequestSessionId(request) {
        return request?.sessionId || null;
    }

    cacheStreamState(request) {
        const sessionId = this.getRequestSessionId(request);
        if (!sessionId) return null;

        const previous = this.streamStates.get(sessionId) || {};
        const next = {
            ...previous,
            sessionId
        };

        if (request.text !== undefined) {
            const rawText = request.text || "";
            const split = splitToolCallFromText(rawText, { allowPartial: true });
            next.rawText = rawText;
            next.text = split.displayText;
            if (split.hasToolCall) {
                next.toolCallText = split.toolCallText;
            }
        }
        if (request.thoughts !== undefined) {
            next.thoughts = request.thoughts || "";
        }
        if (hasDisplayableThoughts(next.thoughts)) {
            if (!Number.isFinite(next.thoughtsStartedAt)) {
                const elapsedSeconds = Number.isFinite(next.thoughtsElapsedSeconds)
                    ? next.thoughtsElapsedSeconds
                    : 0;
                next.thoughtsStartedAt = Date.now() - (elapsedSeconds * 1000);
            }
            next.thoughtsElapsedSeconds = Math.max(0, (Date.now() - next.thoughtsStartedAt) / 1000);
        }
        if (request.contextState !== undefined) {
            next.contextState = request.contextState || null;
        }

        this.streamStates.set(sessionId, next);
        return next;
    }

    clearStreamState(sessionId = null) {
        if (sessionId) {
            this.streamStates.delete(sessionId);
            return;
        }
        this.streamStates.clear();
    }

    createStreamingBubble(state = {}) {
        const bubble = appendMessage(this.ui.historyDiv, "", 'ai', null, "", null, {
            isStreaming: true,
            thoughtsStartedAt: state.thoughtsStartedAt,
            thoughtsElapsedSeconds: state.thoughtsElapsedSeconds
        });

        bubble.update(state.text || "", state.thoughts || "", {
            isStreaming: true,
            thoughtsStartedAt: state.thoughtsStartedAt,
            thoughtsElapsedSeconds: state.thoughtsElapsedSeconds
        });
        this.streamingBubble = bubble;
    }

    handleStreamUpdate(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        const state = this.cacheStreamState(request);
        const displayText = state?.text || "";

        // Prevent race condition: Ignore stream updates arriving shortly after user cancelled
        if (this.app.prompt.isCancellationRecent()) {
            this.clearStreamState(this.getRequestSessionId(request));
            return;
        }

        if (!this.isCurrentSessionMessage(request)) return;

        // If we don't have a bubble yet, create one
        if (!this.streamingBubble) {
            this.createStreamingBubble(state);
        }
        
        // Update content if text or thoughts exist
        this.streamingBubble.update(displayText, request.thoughts, { isStreaming: true });
        
        // Ensure UI state reflects generation
        if (!this.app.isGenerating) {
            this.app.isGenerating = true;
            this.ui.setLoading(true);
        }
    }

    handleContextStatus(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        const state = this.cacheStreamState({
            ...request,
            contextState: request.state === 'compressing' ? request.state : null
        });
        if (!this.isCurrentSessionMessage(request)) return;

        if (request.state === 'compressing') {
            if (this.contextCompressionNotice) {
                this.contextCompressionNotice.dispose?.();
            }
            this.contextCompressionNotice = appendContextCompressionNotice(
                this.ui.historyDiv,
                t('contextCompressing')
            );
            return;
        }

        if (!this.contextCompressionNotice) return;

        if (request.state === 'compressed') {
            this.contextCompressionNotice.update(t('contextCompressed'));
            this.contextCompressionNotice = null;
            if (state) state.contextState = null;
            return;
        }

        if (request.state === 'compression_failed') {
            this.contextCompressionNotice.update(t('contextCompressionFallback'));
            this.contextCompressionNotice = null;
            if (state) state.contextState = null;
        }
    }

    handleGeminiReply(request) {
        if (!this.isGeneratingSessionMessage(request)) return;

        this.app.isGenerating = false;
        this.app.generatingSessionId = null;
        this.ui.setLoading(false);
        this.app.sessionFlow.refreshHistoryUI();
        this.clearStreamState(this.getRequestSessionId(request));

        if (!this.isCurrentSessionMessage(request)) {
            this.resetStream();
            return;
        }
        
        const session = this.sessionManager.getCurrentSession();
        if (session) {
            // Note: We do NOT save to sessionManager/storage here anymore.
            // The background script saves the AI response to storage and broadcasts 'SESSIONS_UPDATED'.
            // The AppController handles that broadcast to keep data in sync.
            // We just ensure the UI is visually complete here.

            if (request.status === 'success') {
                // Although session data comes from background, we might want to ensure context matches locally
                // just in case further user prompts happen before SESSIONS_UPDATED arrives (rare)
                this.sessionManager.updateContext(session.id, request.context);
            }

            // Update UI
            if (this.streamingBubble) {
                // Finalize the streaming bubble with complete text and thoughts
                this.streamingBubble.finalize(request.text, request.thoughts, {
                    thoughtsDurationSeconds: request.thoughtsDurationSeconds
                });
                
                // Inject images if any
                if (request.images && request.images.length > 0) {
                    this.streamingBubble.addImages(request.images);
                }

                if (request.sources && request.sources.length > 0) {
                    this.streamingBubble.addSources(request.sources);
                }
                
                if (request.status !== 'success') {
                    // Optionally style error
                }
                
                // Clear reference
                this.streamingBubble = null;
            } else {
                // Fallback if no stream occurred (or single short response)
                if (this.hasStorageRenderedAiReply(session, request)) {
                    return;
                }
                appendMessage(this.ui.historyDiv, request.text, 'ai', request.images, request.thoughts, request.sources, {
                    isFinal: true,
                    thoughtsDurationSeconds: request.thoughtsDurationSeconds
                });
            }
        }
    }

    handleToolOutputMessage(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        const sessionId = this.getRequestSessionId(request);
        const toolCallText = this.getRequestToolCallText(request, sessionId);

        if (!this.isCurrentSessionMessage(request)) {
            this.clearStreamState(sessionId);
            return;
        }

        this.finalizeActiveStream({
            text: this.getStreamRawText(sessionId) || request.toolCallText,
            thoughts: this.getStreamThoughts(sessionId),
            clearToolCallJson: true
        });
        this.clearStreamState(sessionId);

        const session = this.sessionManager.getCurrentSession();
        const renderedKey = this.getToolOutputKey(request);
        if (renderedKey && this.hasRenderedToolOutput(renderedKey)) {
            this.removeRenderedToolStatus(this.getToolStatusKey(request));
            return;
        }

        this.removeRenderedToolStatus(this.getToolStatusKey(request));

        if (session && !this.hasPersistedToolOutput(session, request)) {
            session.messages.push({
                role: 'user',
                text: this.buildToolOutputHistoryText(request),
                image: request.images || null,
                kind: 'tool-output',
                toolName: request.toolName || '',
                toolStatus: request.status || this.getToolOutputStatus(request),
                toolCallText,
                toolStep: request.step,
                toolCallIndex: request.callIndex,
                toolCallCount: request.callCount
            });
            session.timestamp = Date.now();
            this.app.sessionFlow.refreshHistoryUI();
        }

        appendMessage(
            this.ui.historyDiv,
            request.text || '',
            'user',
            request.images || null,
            null,
            null,
            {
                kind: 'tool-output',
                toolName: request.toolName || '',
                toolStatus: request.status || this.getToolOutputStatus(request),
                toolCallText,
                step: request.step,
                callIndex: request.callIndex,
                callCount: request.callCount,
                toolOutputKey: renderedKey
            }
        );
        this.ui.scrollToBottom();
    }

    handleToolCallStatusMessage(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        if (!this.isCurrentSessionMessage(request)) return;

        const sessionId = this.getRequestSessionId(request);
        const toolCallText = this.getRequestToolCallText(request, sessionId);
        this.finalizeActiveStream({
            text: this.getStreamRawText(sessionId) || request.toolCallText,
            thoughts: this.getStreamThoughts(sessionId),
            clearToolCallJson: true
        });
        this.clearStreamState(sessionId);

        const statusKey = request.statusKey || this.getToolStatusKey(request);
        const existing = this.findRenderedToolStatus(statusKey);
        if (existing && typeof existing.update === 'function') {
            existing.update(request.text || '', null, {
                toolStatus: request.status || 'completed',
                toolCallText,
                callIndex: request.callIndex,
                callCount: request.callCount,
                isCollapsed: true
            });
            this.ui.scrollToBottom();
            return;
        }

        const controller = appendMessage(
            this.ui.historyDiv,
            request.text || '',
            'user',
            null,
            null,
            null,
            {
                kind: 'tool-status',
                toolName: request.toolName || '',
                toolStatus: request.status || 'running',
                toolCallText,
                callIndex: request.callIndex,
                callCount: request.callCount,
                toolStatusKey: statusKey,
                isCollapsed: true
            }
        );

        this.ui.scrollToBottom();
        return controller;
    }

    finalizeActiveStream(state = {}) {
        if (!this.streamingBubble) return;
        let finalText;
        if (state.clearToolCallJson) {
            const split = splitToolCallFromText(state.text || "", { allowPartial: true });
            if (split.hasToolCall) {
                finalText = split.displayText;
            } else if (isToolCallOnlyText(state.text, { allowPartial: true })) {
                finalText = "";
            }
            finalText = finalText || "";
        }
        if (state.clearToolCallJson && !hasDisplayableText(finalText) && !hasDisplayableThoughts(state.thoughts)) {
            if (typeof this.streamingBubble.dispose === 'function') {
                this.streamingBubble.dispose();
            }
            if (this.streamingBubble.div && typeof this.streamingBubble.div.remove === 'function') {
                this.streamingBubble.div.remove();
            }
            this.streamingBubble = null;
            return;
        }
        if (typeof this.streamingBubble.finalize === 'function') {
            this.streamingBubble.finalize(finalText, undefined, {
                suppressCopy: state.clearToolCallJson === true
            });
        } else if (typeof this.streamingBubble.dispose === 'function') {
            this.streamingBubble.dispose();
        }
        this.streamingBubble = null;
    }

    getStreamToolCallText(sessionId) {
        if (!sessionId) return "";
        const state = this.streamStates.get(sessionId);
        if (typeof state?.toolCallText === 'string' && state.toolCallText.trim()) {
            return state.toolCallText;
        }
        const split = splitToolCallFromText(state?.rawText || state?.text || "", { allowPartial: true });
        return split.toolCallText;
    }

    getStreamRawText(sessionId) {
        if (!sessionId) return "";
        const state = this.streamStates.get(sessionId);
        return typeof state?.rawText === 'string' ? state.rawText : (state?.text || "");
    }

    getStreamThoughts(sessionId) {
        if (!sessionId) return "";
        const state = this.streamStates.get(sessionId);
        return typeof state?.thoughts === 'string' ? state.thoughts : "";
    }

    getRequestToolCallText(request, sessionId) {
        const requestText = typeof request?.toolCallText === 'string' ? request.toolCallText : "";
        const split = splitToolCallFromText(requestText, { allowPartial: true });
        if (split.hasToolCall) return split.toolCallText;
        if (isToolCallOnlyText(requestText, { allowPartial: true })) return requestText.trim();
        return this.getStreamToolCallText(sessionId);
    }

    buildToolOutputHistoryText(request) {
        const toolName = request.toolName || 'tool';
        const step = Number.isFinite(request.step) ? request.step : '';
        const suffix = step ? `\n\n[Proceeding to step ${step}]` : '';
        return `[Tool Output: ${toolName}]\n${request.text || ''}${suffix}`;
    }

    getToolOutputKey(request) {
        if (!request) return '';
        return [
            request.sessionId || '',
            request.toolName || '',
            Number.isFinite(request.step) ? request.step : '',
            Number.isFinite(request.callIndex) ? request.callIndex : '',
            request.text || ''
        ].join('|');
    }

    hasRenderedToolOutput(key) {
        if (!key || !this.ui || !this.ui.historyDiv) return false;
        return Array.from(this.ui.historyDiv.querySelectorAll('[data-tool-output-key]'))
            .some(element => element.dataset.toolOutputKey === key);
    }

    getToolStatusKey(request) {
        if (!request) return '';
        const parts = [
            request.sessionId || '',
            request.toolName || ''
        ];
        if (Number.isFinite(request.callIndex) && Number.isFinite(request.callCount) && request.callCount > 1) {
            parts.push(String(request.callIndex));
        }
        return parts.join('|');
    }

    findRenderedToolStatus(key) {
        if (!key || !this.ui || !this.ui.historyDiv) return null;
        const element = Array.from(this.ui.historyDiv.querySelectorAll('[data-tool-status-key]'))
            .find(candidate => candidate.dataset.toolStatusKey === key);
        return element?.__messageController || null;
    }

    removeRenderedToolStatus(key) {
        const controller = this.findRenderedToolStatus(key);
        if (!controller) return;
        if (typeof controller.dispose === 'function') {
            controller.dispose();
        }
        if (controller.div && typeof controller.div.remove === 'function') {
            controller.div.remove();
        }
    }

    hasPersistedToolOutput(session, request) {
        if (!session || !Array.isArray(session.messages)) return false;
        const expected = this.buildToolOutputHistoryText(request);
        return session.messages.some(message => {
            return message && message.role === 'user' && message.text === expected;
        });
    }

    getToolOutputStatus(request) {
        const text = typeof request?.text === 'string' ? request.text.trim() : '';
        return text.startsWith('Error executing tool:') ? 'failed' : 'completed';
    }

    handleImageResult(request) {
        this.ui.updateStatus("");
        if (request.error) {
            console.error("Image fetch failed", request.error);
            this.ui.updateStatus(t('failedLoadImage'));
            setTimeout(() => this.ui.updateStatus(""), 3000);
        } else {
            this.imageManager.setFile(request.base64, request.type, request.name);
        }
    }

    async handleGeneratedImageResult(request) {
        // Find the placeholder image by ID
        const img = document.querySelector(`img[data-req-id="${request.reqId}"]`);
        if (img) {
            if (request.base64) {
                try {
                    // Apply Watermark Removal
                    const cleanedBase64 = await WatermarkRemover.process(request.base64);
                    img.src = cleanedBase64;
                } catch (e) {
                    console.warn("Watermark removal failed, using original", e);
                    img.src = request.base64;
                }
                
                img.classList.remove('loading');
                img.style.minHeight = "auto"; 
            } else {
                // Handle error visually
                img.style.background = "#ffebee"; // Light red
                img.alt = "Failed to load image";
                console.warn("Generated image load failed:", request.error);
            }
        }
    }

    async handleCropResult(request) {
        this.ui.updateStatus(t('processingImage'));
        try {
            const croppedBase64 = await cropImage(request.image, request.area);
            this.imageManager.setFile(croppedBase64, 'image/png', 'snip.png');
            
            if (this.app.captureMode === 'ocr') {
                // Change prompt to localized OCR instructions
                this.ui.inputFn.value = t('ocrPrompt');
                // Auto-send via the main controller
                this.app.handleSendMessage(); 
            } else if (this.app.captureMode === 'screenshot_translate') {
                // Change prompt to localized Translate instructions
                this.ui.inputFn.value = t('screenshotTranslatePrompt');
                this.app.handleSendMessage();
            } else {
                this.ui.updateStatus("");
                this.ui.inputFn.focus();
            }
        } catch (e) {
            console.error("Crop error", e);
            this.ui.updateStatus(t('errorScreenshot'));
        }
    }
    
    handleSelectionResult(request) {
        if (request.text && request.text.trim()) {
             const quote = `> ${request.text.trim()}\n\n`;
             const input = this.ui.inputFn;
             // Append to new line if text exists
             input.value = input.value ? input.value + "\n\n" + quote : quote;
             input.focus();
             // Trigger resize
             input.dispatchEvent(new Event('input'));
        } else {
             this.ui.updateStatus(t('noTextSelected'));
             setTimeout(() => this.ui.updateStatus(""), 2000);
        }
    }

    // Called by AppController on cancel/switch
    resetStream(options = {}) {
        if (this.streamingBubble) {
            if (typeof this.streamingBubble.dispose === 'function') {
                this.streamingBubble.dispose();
            }
            if (options.remove === true && this.streamingBubble.div) {
                this.streamingBubble.div.remove();
            }
            this.streamingBubble = null;
        }
        if (this.contextCompressionNotice && options.remove === true) {
            this.contextCompressionNotice.dispose?.();
        }
        this.contextCompressionNotice = null;
    }

    clearActiveStream() {
        const activeSessionId = this.app.generatingSessionId || this.sessionManager.currentSessionId || null;
        this.clearStreamState(activeSessionId);
        this.resetStream({ remove: true });
    }

    restoreStreamForSession(sessionId) {
        if (!sessionId || sessionId !== this.app.generatingSessionId) return;
        const state = this.streamStates.get(sessionId);
        if (!state) return;
        const session = this.sessionManager.getCurrentSession();
        if (this.hasPersistedAiReply(session, state)) {
            this.clearStreamState(sessionId);
            return;
        }

        this.resetStream();
        if (state.contextState === 'compressing') {
            this.contextCompressionNotice = appendContextCompressionNotice(
                this.ui.historyDiv,
                t('contextCompressing')
            );
        }
        this.createStreamingBubble(state);
        this.ui.setLoading(true);
    }
}
