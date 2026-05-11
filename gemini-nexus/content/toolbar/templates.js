
// content/toolbar/templates.js
(function() {
    const ICONS = window.GeminiToolbarIcons || {};
    const t = window.GeminiToolbarStrings || {};
    // Combine modular styles (loaded previously)
    const STYLES = window.GeminiToolbarStyles || '';

    const toolbarHTML = `
        <!-- Quick Actions Toolbar (Dark Theme) -->
        <div class="toolbar" id="toolbar">
            <div class="toolbar-drag-handle" id="toolbar-drag">${ICONS.DRAG}</div>
            <button class="btn" id="btn-ask" title="${t.askAi}">${ICONS.LOGO}</button>
            <button class="btn" id="btn-copy" title="${t.copy}">${ICONS.COPY}</button>
            <button class="btn hidden" id="btn-grammar" title="${t.fixGrammar}">${ICONS.GRAMMAR}</button>
            <button class="btn" id="btn-translate" title="${t.translate}">${ICONS.TRANSLATE}</button>
            <button class="btn" id="btn-explain" title="${t.explain}">${ICONS.EXPLAIN}</button>
            <button class="btn" id="btn-summarize" title="${t.summarize}">${ICONS.SUMMARIZE}</button>
        </div>
    `;

    const imageMenuHTML = `
        <!-- Image Button / AI Tools Menu -->
        <div class="image-btn" id="image-btn">
            <div class="ai-tool-trigger" title="${t.aiTools}">
                ${ICONS.LOGO}
            </div>
            <div class="ai-tool-menu">
                <div class="menu-item" id="btn-image-chat">
                    ${ICONS.CHAT_BUBBLE} <span>${t.chatWithImage}</span>
                </div>
                <div class="menu-item" id="btn-image-describe">
                    ${ICONS.IMAGE_EYE} <span>${t.describeImage}</span>
                </div>
                <div class="menu-item" id="btn-image-extract">
                    ${ICONS.SCAN_TEXT} <span>${t.extractText}</span>
                </div>
                
                <div class="menu-item has-submenu">
                    ${ICONS.TOOLS} <span>${t.imageTools}</span>
                    <div class="submenu-arrow">${ICONS.CHEVRON_RIGHT}</div>
                    
                    <div class="submenu">
                        <div class="menu-item" id="btn-image-remove-bg">${ICONS.REMOVE_BG} <span>${t.removeBg}</span></div>
                        <div class="menu-item" id="btn-image-remove-text">${ICONS.REMOVE_TEXT} <span>${t.removeText}</span></div>
                        <div class="menu-item" id="btn-image-remove-watermark">${ICONS.REMOVE_WATERMARK} <span>${t.removeWatermark}</span></div>
                        <div class="menu-item" id="btn-image-upscale">${ICONS.UPSCALE} <span>${t.upscale}</span></div>
                        <div class="menu-item" id="btn-image-expand">${ICONS.EXPAND} <span>${t.expand}</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const windowHTML = `
        <!-- Main Ask Window (Light Theme, Resizable) -->
        <div class="ask-window" id="ask-window">
            <div class="ask-header" id="ask-header">
                <span class="window-title" id="window-title">${t.windowTitle}</span>
                <div class="header-actions">
                    <select id="ask-model-select" class="ask-model-select">
                        <option value="gemini-3-flash">Fast</option>
                        <option value="gemini-3-flash-thinking">Thinking</option>
                        <option value="gemini-3-pro">3 Pro</option>
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
    `;

    window.GeminiToolbarTemplates = {
        mainStructure: `
            <style>${STYLES}</style>
            ${toolbarHTML}
            ${imageMenuHTML}
            ${windowHTML}
        `
    };
})();