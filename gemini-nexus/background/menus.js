
// background/menus.js

/**
 * Initializes Context Menus and attaches the click listener.
 * @param {ImageHandler} imageHandler - Instance of the ImageHandler.
 */
export function setupContextMenus(imageHandler) {
    
    // Create Context Menus with Localization check
    chrome.runtime.onInstalled.addListener(() => {
        const isZh = chrome.i18n.getUILanguage().startsWith('zh');
        
        const titles = {
            main: isZh ? "Gemini Nexus" : "Gemini Nexus",
            ask: isZh ? "快速提问" : "Quick Ask",
            pageChat: isZh ? "与当前网页对话" : "Chat with Page",
            ocr: isZh ? "OCR (文字提取)" : "OCR (Extract Text)",
            screenshotTranslate: isZh ? "截图翻译" : "Screenshot Translate",
            snip: isZh ? "区域截图 (Snip)" : "Snip (Capture Area)"
        };

        const parentMenu = {
            id: "gemini-nexus-parent",
            title: titles.main,
            contexts: ["all"]
        };

        const childMenus = [
            {
                id: "menu-ask",
                parentId: "gemini-nexus-parent",
                title: titles.ask,
                contexts: ["all"]
            },
            {
                id: "menu-page-chat",
                parentId: "gemini-nexus-parent",
                title: titles.pageChat,
                contexts: ["all"]
            },
            {
                id: "menu-ocr",
                parentId: "gemini-nexus-parent",
                title: titles.ocr,
                contexts: ["all"]
            },
            {
                id: "menu-screenshot-translate",
                parentId: "gemini-nexus-parent",
                title: titles.screenshotTranslate,
                contexts: ["all"]
            },
            {
                id: "menu-snip",
                parentId: "gemini-nexus-parent",
                title: titles.snip,
                contexts: ["all"]
            }
        ];

        const createMenu = (item, onDone = () => {}) => {
            chrome.contextMenus.create(item, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`Failed to create context menu ${item.id}:`, chrome.runtime.lastError.message);
                    return;
                }
                onDone();
            });
        };

        chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
                console.warn("Failed to reset context menus:", chrome.runtime.lastError.message);
                return;
            }

            createMenu(parentMenu, () => {
                childMenus.forEach(item => createMenu(item));
            });
        });
    });

    // Handle Context Menu Clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (!tab) return;

        // 获取当前点击的菜单项
        const menuId = info.menuItemId;

        if (menuId === "menu-ask") {
            chrome.tabs.sendMessage(tab.id, { 
                action: "CONTEXT_MENU_ACTION", 
                mode: "ask" 
            }).catch(() => {});
        } else if (menuId === "menu-page-chat") {
            // 直接通知内容脚本打开对话窗口并启用网页上下文
            chrome.tabs.sendMessage(tab.id, { 
                action: "CONTEXT_MENU_ACTION", 
                mode: "page_chat" 
            }).catch(() => {});
        } else if (menuId === "menu-ocr" || menuId === "menu-snip" || menuId === "menu-screenshot-translate") {
            let mode = "snip";
            if (menuId === "menu-ocr") mode = "ocr";
            if (menuId === "menu-screenshot-translate") mode = "screenshot_translate";
            
            // 通知内容脚本准备截图
            chrome.tabs.sendMessage(tab.id, { 
                action: "CONTEXT_MENU_ACTION", 
                mode: mode 
            }).catch(() => {});
        }
    });
}
