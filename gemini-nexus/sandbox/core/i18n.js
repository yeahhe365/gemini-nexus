
// sandbox/core/i18n.js

export const translations = {
    en: {
        "searchPlaceholder": "Search for chats",
        "recentLabel": "Recent",
        "noConversations": "No conversations found.",
        "settings": "Settings",
        "chatHistory": "Chat History",
        "newChat": "New Chat",
        "pageContext": "Page",
        "browserControl": "Browser Control",
        "quote": "Quote",
        "ocr": "OCR",
        "snip": "Snip",
        "screenshotTranslate": "Translate",
        "uploadImage": "Upload Image",
        "askPlaceholder": "Ask Gemini...",
        "sendMessage": "Send message",
        "stopGenerating": "Stop generating",
        "settingsTitle": "Settings",
        "general": "General",
        "connection": "Connection",
        "connectionProvider": "Model Provider",
        "providerWeb": "Gemini Web Client (Free)",
        "providerOfficial": "Google Gemini API",
        "providerOpenAI": "OpenAI Compatible API",
        "mcpTools": "External MCP Tools",
        "mcpToolsDesc": "Connect to an MCP server and use its tools in chat.",
        "mcpActiveServer": "Active Server",
        "mcpAddServer": "Add",
        "mcpRemoveServer": "Remove",
        "mcpServerName": "Name",
        "mcpTestConnection": "Test Connection",
        "mcpToolMode": "Expose Tools",
        "mcpToolModeAll": "All tools (default)",
        "mcpToolModeSelected": "Selected tools only",
        "mcpRefreshTools": "Refresh Tools",
        "mcpEnableAllTools": "Enable All",
        "mcpDisableAllTools": "Disable All",
        "mcpToolSearchPlaceholder": "Search tools...",
        "mcpTransport": "MCP Transport",
        "mcpServerUrl": "MCP Server URL",
        "enabled": "Enabled",
        "useOfficialApiDesc": "Use your own API key with Gemini 3 Flash (Low Thinking).",
        "apiKey": "API Key",
        "apiKeyPlaceholder": "Paste your API Key",
        "baseUrl": "Base URL",
        "baseUrlPlaceholder": "e.g. https://api.openai.com/v1",
        "modelId": "Model ID",
        "modelIdPlaceholder": "e.g. gpt-4o, claude-3-5-sonnet",
        "textSelection": "Text Selection Toolbar",
        "textSelectionDesc": "Show floating toolbar when selecting text.",
        "imageToolsToggle": "Show Image Tools Button",
        "imageToolsToggleDesc": "Show the AI button when hovering over images.",
        "sidebarBehavior": "When Sidebar Reopens",
        "sidebarBehaviorAuto": "Auto restore or restart",
        "sidebarBehaviorAutoDesc": "Restore if opened within 10 mins, otherwise start new chat.",
        "sidebarBehaviorRestore": "Always restore previous chat",
        "sidebarBehaviorNew": "Always start new chat",
        "accountIndices": "Account Indices (Multi-account)",
        "accountIndicesDesc": "Comma-separated user indices (e.g., 0, 1, 2) for polling.",
        "appearance": "Appearance",
        "theme": "Theme",
        "language": "Language",
        "keyboardShortcuts": "Keyboard Shortcuts",
        "shortcutDesc": "Click input and press keys to change.",
        "quickAsk": "Quick Ask (Floating)",
        "openSidePanel": "Open Side Panel",
        "openExtension": "Open Extension",
        "shortcutFocusInput": "Focus Input",
        "shortcutSwitchModel": "Switch Model (in Input)",
        "shortcutBrowserControl": "Open Browser Control",
        "resetDefault": "Reset Default",
        "saveChanges": "Save Changes",
        "system": "System",
        "debugLogs": "Debug Logs",
        "downloadLogs": "Download Logs",
        "about": "About",
        "sourceCode": "Source Code",
        "buyMeCoffee": "Buy Me a Coffee",
        "system": "System Default",
        "light": "Light",
        "dark": "Dark",
        "pageContextActive": "Chat with page is already active",
        "pageContextEnabled": "Chat will include page content",
        "cancelled": "Cancelled.",
        "thinking": "Gemini is thinking...",
        "deleteChatConfirm": "Delete this chat?",
        "delete": "Delete",
        "exportChat": "Export",
        "exportSuccess": "Chat exported successfully",
        "noMessagesToExport": "No messages to export",
        "imageSent": "Image sent",
        "selectOcr": "Select area for OCR...",
        "selectSnip": "Select area to capture...",
        "selectTranslate": "Select area to translate...",
        "processingImage": "Processing image...",
        "failedLoadImage": "Failed to load image.",
        "errorScreenshot": "Error processing screenshot.",
        "noTextSelected": "No text selected on page.",
        "ocrPrompt": "Please OCR this image. Extract the text content exactly as is, without any explanation.",
        "screenshotTranslatePrompt": "Please extract the text from this image and translate it into English. Output ONLY the translation.",
        "loadingImage": "Loading image...",
        "readingPage": "Reading page content...",
        "pageReadSuccess": "Read page content (~{count} chars)",
        
        // Tooltips
        "toggleHistory": "Chat History",
        "newChatTooltip": "New Chat",
        "exportChatTooltip": "Export Current Chat",
        "pageContextTooltip": "Toggle chat with page content",
        "browserControlTooltip": "Allow model to control the browser",
        "quoteTooltip": "Quote selected text from page",
        "ocrTooltip": "Capture area and extract text",
        "screenshotTranslateTooltip": "Capture area and translate text",
        "snipTooltip": "Capture area to input",
        "removeImage": "Remove image",
        "uploadImageTooltip": "Upload Image",
        "zoomOut": "Zoom Out",
        "zoomIn": "Zoom In",
        "resetZoom": "Fit to Screen",
        "downloadImage": "Download Image",
        "close": "Close",
        "sendMessageTooltip": "Send message",
        "openFullPageTooltip": "Open in full page",
        "modelSelectTooltip": "Select Model (Tab to cycle)",
        "selectTab": "Select Active Tab",
        "selectTabTooltip": "Select a tab to control",
        "noTabsFound": "No open tabs found.",
        "lockTab": "Lock Tab",
        "unlockTab": "Unlock Tab (Auto-follow Active)",
    },
    zh: {
        "mcpTools": "外部 MCP 工具",
        "mcpToolsDesc": "连接到 MCP 服务器，并在对话中调用其工具。",
        "mcpActiveServer": "当前服务器",
        "mcpAddServer": "添加",
        "mcpRemoveServer": "移除",
        "mcpServerName": "名称",
        "mcpTestConnection": "测试连接",
        "mcpToolMode": "工具暴露方式",
        "mcpToolModeAll": "全部工具（默认）",
        "mcpToolModeSelected": "仅选择的工具",
        "mcpRefreshTools": "刷新工具列表",
        "mcpEnableAllTools": "全部启用",
        "mcpDisableAllTools": "全部禁用",
        "mcpToolSearchPlaceholder": "搜索工具...",
        "mcpTransport": "MCP 传输方式",
        "mcpServerUrl": "MCP 服务器地址",
        "enabled": "启用",
        "searchPlaceholder": "搜索对话",
        "recentLabel": "最近",
        "noConversations": "未找到对话。",
        "settings": "设置",
        "chatHistory": "历史记录",
        "newChat": "新对话",
        "pageContext": "网页",
        "browserControl": "浏览器控制",
        "quote": "引用",
        "ocr": "OCR",
        "snip": "截图",
        "screenshotTranslate": "截图翻译",
        "uploadImage": "上传图片",
        "askPlaceholder": "询问 Gemini...",
        "sendMessage": "发送消息",
        "stopGenerating": "停止生成",
        "settingsTitle": "设置",
        "general": "常规",
        "connection": "连接",
        "connectionProvider": "模型来源",
        "providerWeb": "Gemini 网页版 (免费)",
        "providerOfficial": "Google Gemini 官方 API",
        "providerOpenAI": "OpenAI 兼容 API",
        "useOfficialApiDesc": "使用自定义 API Key (Gemini 3 Flash, Low Thinking)。",
        "apiKey": "API Key",
        "apiKeyPlaceholder": "粘贴 API Key",
        "baseUrl": "Base URL (接口地址)",
        "baseUrlPlaceholder": "例如 https://api.openai.com/v1",
        "modelId": "模型 ID",
        "modelIdPlaceholder": "例如 gpt-4o, claude-3-5-sonnet",
        "textSelection": "划词工具栏",
        "textSelectionDesc": "选中网页文本时显示悬浮工具栏。",
        "imageToolsToggle": "显示图片工具按钮",
        "imageToolsToggleDesc": "鼠标悬停在图片上时显示 AI 按钮。",
        "sidebarBehavior": "当侧边栏重新打开时",
        "sidebarBehaviorAuto": "自动恢复或重新开始",
        "sidebarBehaviorAutoDesc": "如果在10分钟内重新打开，聊天将恢复；如果超过10分钟，将开始新的聊天",
        "sidebarBehaviorRestore": "始终恢复上次的聊天",
        "sidebarBehaviorNew": "始终开始新的聊天",
        "accountIndices": "多账号轮询 (Account Indices)",
        "accountIndicesDesc": "输入逗号分隔的账号索引值 (如 0, 1, 7) 以开启轮询。",
        "appearance": "外观",
        "theme": "主题",
        "language": "语言",
        "keyboardShortcuts": "快捷键",
        "shortcutDesc": "点击输入框并按下按键以修改。",
        "quickAsk": "快速提问 (悬浮)",
        "openSidePanel": "打开侧边栏",
        "openExtension": "打开扩展",
        "shortcutFocusInput": "聚焦输入框",
        "shortcutSwitchModel": "切换模型 (输入框内)",
        "shortcutBrowserControl": "打开浏览器控制",
        "resetDefault": "恢复默认",
        "saveChanges": "保存更改",
        "system": "系统",
        "debugLogs": "调试日志",
        "downloadLogs": "下载日志",
        "about": "关于",
        "sourceCode": "源代码",
        "buyMeCoffee": "请我喝咖啡",
        "system": "跟随系统",
        "light": "浅色",
        "dark": "深色",
        "pageContextActive": "网页对话已激活",
        "pageContextEnabled": "对话将包含网页内容",
        "cancelled": "已取消",
        "thinking": "Gemini 正在思考...",
        "deleteChatConfirm": "确认删除此对话？",
        "delete": "删除",
        "exportChat": "导出",
        "exportSuccess": "对话已导出",
        "noMessagesToExport": "没有可导出的消息",
        "imageSent": "图片已发送",
        "selectOcr": "请框选要识别的区域...",
        "selectSnip": "请框选要截图的区域...",
        "selectTranslate": "请框选要翻译的区域...",
        "processingImage": "正在处理图片...",
        "failedLoadImage": "图片加载失败。",
        "errorScreenshot": "截图处理出错。",
        "noTextSelected": "页面上未选择文本。",
        "ocrPrompt": "请识别并提取这张图片中的文字 (OCR)。仅输出识别到的文本内容，不需要任何解释。",
        "screenshotTranslatePrompt": "请识别这张图片中的文字并将其翻译成中文。仅输出翻译后的内容。",
        "loadingImage": "正在加载图片...",
        "readingPage": "正在读取网页内容...",
        "pageReadSuccess": "已读取网页内容 (约 {count} 字)",

        // Tooltips
        "toggleHistory": "历史记录",
        "newChatTooltip": "新对话",
        "exportChatTooltip": "导出当前对话",
        "pageContextTooltip": "切换网页上下文对话",
        "browserControlTooltip": "允许模型控制浏览器",
        "quoteTooltip": "引用网页选中内容",
        "ocrTooltip": "区域截图 (OCR文字提取)",
        "screenshotTranslateTooltip": "截取区域并翻译文字",
        "snipTooltip": "区域截图 (作为图片输入)",
        "removeImage": "移除图片",
        "uploadImageTooltip": "上传图片",
        "zoomOut": "缩小",
        "zoomIn": "放大",
        "resetZoom": "适应屏幕",
        "downloadImage": "下载图片",
        "close": "关闭",
        "sendMessageTooltip": "发送消息",
        "openFullPageTooltip": "新标签页打开",
        "modelSelectTooltip": "选择模型 (按 Tab 切换)",
        "selectTab": "选择活动标签页",
        "selectTabTooltip": "选择要控制的标签页",
        "noTabsFound": "未找到打开的标签页。",
        "lockTab": "锁定标签页",
        "unlockTab": "解锁 (自动跟随活动标签页)",
    }
};

export function resolveLanguage(pref) {
    if (pref === 'system') {
        return navigator.language.startsWith('zh') ? 'zh' : 'en';
    }
    return pref;
}

let savedPreference = 'system';
let currentLang = resolveLanguage(savedPreference);

// Apply initial lang attribute for CSS/DOM consistency
try {
    document.documentElement.lang = currentLang;
} catch(e) {}

export function setLanguagePreference(pref) {
    savedPreference = pref;
    currentLang = resolveLanguage(pref);
    document.documentElement.lang = currentLang;
}

export function getLanguagePreference() {
    return savedPreference;
}

export function t(key) {
    return translations[currentLang][key] || key;
}

export function applyTranslations() {
    // 1. Text Content
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (text) el.textContent = text;
    });
    
    // 2. Placeholders
    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = t(key);
        if (text) el.placeholder = text;
    });

    // 3. Titles (Tooltips)
    const titles = document.querySelectorAll('[data-i18n-title]');
    titles.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = t(key);
        if (text) el.title = text;
    });
}
