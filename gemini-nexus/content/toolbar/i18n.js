
// content/toolbar/i18n.js

(function() {
    // Simple localization for Content Script
    const isZh = navigator.language.startsWith('zh');
    
    window.GeminiToolbarStrings = {
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
        stopGenerating: isZh ? "停止生成" : "Stop generating",
        
        // AI Tools Menu
        aiTools: isZh ? "AI 工具" : "AI Tools",
        chatWithImage: isZh ? "带图片聊天" : "Chat with image",
        describeImage: isZh ? "描述图片" : "Describe image",
        extractText: isZh ? "提取文本" : "Extract text",
        imageTools: isZh ? "图像工具" : "Image tools",
        removeBg: isZh ? "背景移除" : "Remove background",
        removeText: isZh ? "文字移除" : "Remove text",
        removeWatermark: isZh ? "去水印" : "Remove Watermark",
        upscale: isZh ? "画质提升" : "Upscale",
        expand: isZh ? "扩图" : "Expand",

        // Actions UI
        browserControl: isZh ? "浏览器控制" : "Browser Control",
        pageContext: isZh ? "网页" : "Page",
        quote: isZh ? "引用" : "Quote",
        ocr: isZh ? "OCR" : "OCR",
        translateAction: isZh ? "翻译" : "Translate",
        snip: isZh ? "截图" : "Snip",

        // --- AI Prompts (Centralized) ---
        prompts: {
            // Image Actions
            ocr: isZh ? 
                "请识别并提取这张图片中的文字 (OCR)。仅输出识别到的文本内容，不需要任何解释。" : 
                "Please OCR this image. Extract the text content exactly as is, without any explanation.",
            
            imageTranslate: isZh ? 
                "请识别图片中的文字并翻译：如果是英文则译为中文，是中文则译为英文，其他语言译为中文。仅输出翻译结果。" : 
                "Extract text and translate: If English -> Chinese, If Chinese -> English, Others -> Chinese. Output only translation.",
            
            analyze: isZh ? 
                "请详细分析并描述这张图片的内容。" : 
                "Please analyze and describe the content of this image in detail.",
            
            upscale: isZh ? 
                "请根据这张图片生成一个更高清晰度、更高分辨率的版本 (Upscale)。" : 
                "Please generate a higher quality, higher resolution version of this image (Upscale).",
            
            expand: isZh ?
                "请对这张图片进行扩图 (Outpainting)，在保持原图风格的基础上，向四周扩展画面内容。" :
                "Please expand this image (Outpainting), extending the content around the edges while maintaining the original style.",
            
            removeText: isZh ? 
                "请将这张图片中的所有文字移除，并填充背景，生成一张干净的图片。" : 
                "Please remove all text from this image, inpaint the background, and generate the clean image.",
            
            removeBg: isZh ? 
                "请移除这张图片的背景。生成一张带有透明背景的主体图片。" : 
                "Please remove the background from this image. Generate a new image of the subject on a transparent background.",
            
            removeWatermark: isZh ? 
                "请移除这张图片上的所有水印、Logo 或覆盖文字，并完美填充背景，使其看起来像原始图片。" : 
                "Please remove any watermarks, logos, or overlay text from this image, filling in the background seamlessly to look like the original image.",
            
            snipAnalyze: isZh ? 
                "请详细描述这张截图的内容。" : 
                "Please describe the content of this screenshot in detail.",

            // Text Actions
            textTranslate: (text) => isZh ? 
                `请将以下文本翻译：\n- 如果是英文，翻译为中文。\n- 如果是中文，翻译为英文。\n- 如果是其他语言，翻译为中文。\n\n仅输出翻译结果，不要包含任何解释：\n\n"${text}"` : 
                `Translate the following text:\n- If it is English, translate to Chinese.\n- If it is Chinese, translate to English.\n- If it is any other language, translate to Chinese.\n\nOutput ONLY the translation, no explanation:\n\n"${text}"`,
            
            explain: (text) => isZh ? 
                `用通俗易懂的语言简要解释以下内容：\n\n"${text}"` : 
                `Briefly explain the following text in simple language:\n\n"${text}"`,
            
            summarize: (text) => isZh ? 
                `请尽量简洁地总结以下内容：\n\n"${text}"` : 
                `Concise summary of the following text:\n\n"${text}"`,
            
            grammar: (text) => isZh ? 
                `请修正以下文本的语法和拼写错误，保持原意不变。仅输出修正后的文本，不要添加任何解释：\n\n"${text}"` : 
                `Correct the grammar and spelling of the following text. Output ONLY the corrected text without any explanation:\n\n"${text}"`
        },
        
        // Loading Messages
        loading: {
            ocr: isZh ? "正在识别文字..." : "Extracting text...",
            translate: isZh ? "正在翻译..." : "Translating...",
            analyze: isZh ? "正在分析图片内容..." : "Analyzing image content...",
            upscale: isZh ? "正在提升画质..." : "Upscaling...",
            expand: isZh ? "正在扩图..." : "Expanding image...",
            removeText: isZh ? "正在移除文字..." : "Removing text...",
            removeBg: isZh ? "正在移除背景..." : "Removing background...",
            removeWatermark: isZh ? "正在去除水印..." : "Removing watermark...",
            snip: isZh ? "正在分析截图..." : "Analyzing snip...",
            explain: isZh ? '正在解释...' : 'Explaining...',
            summarize: isZh ? '正在总结...' : 'Summarizing...',
            grammar: isZh ? '正在修正...' : 'Fixing grammar...',
            regenerate: isZh ? "正在重新生成..." : "Regenerating..."
        },

        // Input Placeholders (for quick action UI)
        inputs: {
            ocr: isZh ? "文字提取" : "OCR Extract",
            translate: isZh ? "截图翻译" : "Image Translate",
            analyze: isZh ? "分析图片内容" : "Analyze image",
            upscale: isZh ? "画质提升" : "Upscale",
            expand: isZh ? "扩图" : "Expand Image",
            removeText: isZh ? "文字移除" : "Remove Text",
            removeBg: isZh ? "背景移除" : "Remove Background",
            removeWatermark: isZh ? "去水印" : "Remove Watermark",
            snip: isZh ? "截图分析" : "Analyze Snip",
            explain: isZh ? '解释选中内容' : 'Explain selected text',
            textTranslate: isZh ? '翻译选中内容' : 'Translate selected text',
            summarize: isZh ? '总结选中内容' : 'Summarize selected text',
            grammar: isZh ? '修正语法' : 'Fixing grammar'
        },
        
        titles: {
            ocr: isZh ? "OCR 文字提取" : "OCR Extraction",
            translate: isZh ? "截图翻译" : "Image Translate",
            analyze: isZh ? "图片分析" : "Image Analysis",
            upscale: isZh ? "画质提升" : "Upscale Image",
            expand: isZh ? "扩图" : "Image Expansion",
            removeText: isZh ? "文字移除" : "Remove Text",
            removeBg: isZh ? "背景移除" : "Remove Background",
            removeWatermark: isZh ? "去水印" : "Remove Watermark",
            snip: isZh ? "截图分析" : "Snip Analysis",
            explain: isZh ? '解释' : 'Explain',
            textTranslate: isZh ? '翻译' : 'Translate',
            summarize: isZh ? '总结' : 'Summarize',
            grammar: isZh ? '语法修正' : 'Fix Grammar'
        }
    };
})();