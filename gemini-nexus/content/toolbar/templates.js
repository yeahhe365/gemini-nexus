
// content/toolbar/templates.js
(function() {
    const ICONS = window.GeminiToolbarIcons;
    
    // Use the aggregated styles from content_toolbar_styles.js
    const STYLES = window.GeminiToolbarStyles || '';

    // Simple localization for Content Script
    const isZh = navigator.language.startsWith('zh');
    const t = {
        askAi: isZh ? "询问 AI" : "Ask AI",
        copy: isZh ? "复制" : "Copy",
        fixGrammar: isZh ? "语法修正" : "Fix Grammar",
        translate: isZh ? "翻译" : "Translate",
        explain: isZh ? "解释" : "Explain",
        summarize: isZh ? "总结" : "Summarize",
        askImage: isZh ? "询问这张图片" : "Ask AI about this image",
        close: isZh ? "关闭" : "Close",
        askPlaceholder: isZh ? "询问 Gemini..." : "Ask Gemini...",
        windowTitle: "Gemini Nexus",
        retry: isZh ? "重试" : "Retry",
        openSidebar: isZh ? "在侧边栏继续" : "Open in Sidebar",
        chat: isZh ? "对话" : "Chat",
        insert: isZh ? "插入" : "Insert",
        insertTooltip: isZh ? "插入到光标位置" : "Insert at cursor",
        replace: isZh ? "替换" : "Replace",
        replaceTooltip: isZh ? "替换选中文本" : "Replace selected text",
        copyResult: isZh ? "复制结果" : "Copy Result",
        stopGenerating: isZh ? "停止生成" : "Stop generating"
    };

    window.GeminiToolbarTemplates = {
        mainStructure: `
            <style>${STYLES}</style>
            
            <!-- Quick Actions Toolbar (Dark Theme) -->
            <div class="toolbar" id="toolbar">
                <div class="toolbar-drag-handle" id="toolbar-drag-handle" title="Drag to move">${ICONS.DRAG_HANDLE}</div>
                <button class="btn" id="btn-ask" title="${t.askAi}">${ICONS.LOGO}</button>
                <button class="btn" id="btn-copy" title="${t.copy}">${ICONS.COPY}</button>
                <button class="btn hidden" id="btn-grammar" title="${t.fixGrammar}">${ICONS.GRAMMAR}</button>
                <button class="btn" id="btn-translate" title="${t.translate}">${ICONS.TRANSLATE}</button>
                <button class="btn" id="btn-explain" title="${t.explain}">${ICONS.EXPLAIN}</button>
                <button class="btn" id="btn-summarize" title="${t.summarize}">${ICONS.SUMMARIZE}</button>
            </div>

            <!-- Image Button -->
            <div class="image-btn" id="image-btn" title="${t.askImage}">
                ${ICONS.IMAGE_EYE}
            </div>

            <!-- Main Ask Window (Light Theme, Resizable) -->
            <div class="ask-window" id="ask-window">
                <div class="ask-header" id="ask-header">
                    <span class="window-title" id="window-title">${t.windowTitle}</span>
                    <div class="header-actions">
                        <select id="ask-model-select" class="ask-model-select">
                            <option value="gemini-2.5-flash">Fast</option>
                            <option value="gemini-2.5-pro">Thinking</option>
                            <option value="gemini-3.0-pro">3 Pro</option>
                        </select>
                        <button class="icon-btn" id="btn-header-close" title="${t.close}">${ICONS.CLOSE}</button>
                    </div>
                </div>
                
                <div class="window-body">
                    <div class="input-container">
                        <input type="text" id="ask-input" placeholder="${t.askPlaceholder}" autocomplete="off">
                    </div>
                    
                    <div class="context-preview hidden" id="context-preview"></div>
                    
                    <div class="result-area" id="result-area">
                        <div class="markdown-body" id="result-text"></div>
                    </div>
                </div>

                <!-- Footer Bar -->
                <div class="window-footer" id="window-footer">
                    <!-- Action Buttons (Shown when done) -->
                    <div class="footer-actions hidden" id="footer-actions">
                        <div class="footer-left">
                            <button class="footer-btn" id="btn-retry" title="${t.retry}">
                                ${ICONS.RETRY}
                            </button>
                            <button class="footer-btn text-btn" id="btn-continue-chat" title="${t.openSidebar}">
                                ${ICONS.CONTINUE} <span>${t.chat}</span>
                            </button>
                        </div>
                        <div class="footer-right">
                            <button class="footer-btn text-btn hidden" id="btn-insert" title="${t.insertTooltip}">
                                ${ICONS.INSERT} <span>${t.insert}</span>
                            </button>
                            <button class="footer-btn text-btn hidden" id="btn-replace" title="${t.replaceTooltip}">
                                ${ICONS.REPLACE} <span>${t.replace}</span>
                            </button>
                             <button class="footer-btn" id="btn-copy-result" title="${t.copyResult}">
                                ${ICONS.COPY}
                            </button>
                        </div>
                    </div>

                    <!-- Stop Button (Shown when generating) -->
                    <div class="footer-stop hidden" id="footer-stop">
                        <button class="stop-pill-btn" id="btn-stop-gen">
                            ${ICONS.STOP} ${t.stopGenerating}
                        </button>
                    </div>
                </div>
            </div>
        `
    };
})();