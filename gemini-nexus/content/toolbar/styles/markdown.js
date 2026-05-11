
(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    window.GeminiStyles.Markdown = `
        /* Result Area */
        .result-area {
            flex: 1;
            overflow-y: auto;
            position: relative;
            font-size: 14px;
            line-height: 1.6;
            color: #1f1f1f;
            padding-right: 4px; /* Space for scrollbar */
            /* No bottom padding needed with separate footer */
        }
        
        .result-area::-webkit-scrollbar { width: 6px; }
        .result-area::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 3px; }
        .result-area::-webkit-scrollbar-thumb:hover { background: #d0d0d0; }

        /* --- Markdown Styles --- */

        .markdown-body p { margin: 0 0 12px 0; }
        .markdown-body p:last-child { margin-bottom: 0; }
        
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 16px 0 8px 0; color: #1f1f1f; font-weight: 600; }
        .markdown-body h1 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .markdown-body h2 { font-size: 18px; }
        .markdown-body h3 { font-size: 16px; }

        .markdown-body ul, .markdown-body ol { margin: 0 0 12px 0; padding-left: 20px; }
        .markdown-body li { margin-bottom: 4px; }

        /* Code Blocks */
        .code-block-wrapper {
            background: #f4f6f8;
            border-radius: 8px;
            border: 1px solid #e1e3e1;
            margin: 12px 0;
            overflow: hidden;
        }

        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: #e1e3e1;
            border-bottom: 1px solid #d0d0d0;
            font-family: sans-serif;
        }

        .code-lang {
            font-size: 11px;
            color: #444;
            text-transform: uppercase;
            font-weight: 600;
        }

        .copy-code-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            color: #555;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            padding: 4px;
            border-radius: 4px;
        }
        .copy-code-btn:hover {
            background: rgba(0,0,0,0.05);
            color: #000;
        }

        .markdown-body pre {
            background: transparent;
            padding: 12px;
            border-radius: 0;
            overflow-x: auto;
            margin: 0;
            border: none;
        }

        .markdown-body code {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 0.9em;
            background: rgba(0,0,0,0.05);
            padding: 2px 4px;
            border-radius: 4px;
            color: #1f1f1f;
        }
        .markdown-body pre code {
            background: transparent;
            padding: 0;
            border: none;
            color: #1f1f1f;
            display: block;
        }

        /* Syntax Highlighting */
        .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
        .hljs-doctag, .hljs-keyword, .hljs-formula { color: #d73a49; }
        .hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #22863a; }
        .hljs-literal { color: #005cc5; }
        .hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta-string { color: #032f62; }
        .hljs-built_in, .hljs-class .hljs-title { color: #6f42c1; }
        .hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #005cc5; }
        .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title { color: #6f42c1; }
        .hljs-emphasis { font-style: italic; }
        .hljs-strong { font-weight: bold; }

        /* Tables */
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
            font-size: 13px;
        }
        .markdown-body th, .markdown-body td {
            border: 1px solid #e1e3e1;
            padding: 8px 12px;
            text-align: left;
        }
        .markdown-body th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .markdown-body tr:nth-child(even) {
            background-color: #fcfcfc;
        }

        /* Links */
        .markdown-body a {
            color: #0b57d0;
            text-decoration: none;
        }
        .markdown-body a:hover {
            text-decoration: underline;
        }

        /* Images (Standard MD images) */
        .markdown-body img {
            max-width: 100%;
            border-radius: 8px;
            margin: 8px 0;
            border: 1px solid #e0e0e0;
        }

        /* Generated Images (Grid Layout) */
        .generated-images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
            margin-top: 12px;
            margin-bottom: 8px;
            width: 100%;
        }

        .generated-image {
            width: 100%;
            height: auto;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            object-fit: contain; /* Full image visible */
            background: #f0f4f9;
        }
        
        .generated-image.loading {
            opacity: 0.7;
            min-height: 150px;
        }

        /* Quotes & Misc */
        .markdown-body blockquote {
            border-left: 4px solid #0b57d0;
            margin: 12px 0;
            padding: 4px 16px;
            color: #444746;
            background: rgba(11, 87, 208, 0.04);
            border-radius: 0 4px 4px 0;
        }
        .markdown-body hr {
            border: none;
            border-top: 1px solid #e1e3e1;
            margin: 16px 0;
        }
    `;
})();
