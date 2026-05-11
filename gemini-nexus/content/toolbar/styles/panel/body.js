(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    window.GeminiStyles.PanelBody = `
        /* --- Window Body --- */

        .window-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 8px 16px 16px 16px;
            overflow: hidden; /* Crucial for internal scroll */
            background: #fff;
            position: relative;
            min-height: 0;
        }

        /* Input Styles */
        .input-container {
            margin-bottom: 12px;
            flex-shrink: 0;
        }
        
        input[type="text"]#ask-input {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            outline: none;
            color: #1f1f1f;
            background: #fff;
            box-sizing: border-box;
            transition: border-color 0.2s;
            font-family: inherit;
        }
        input[type="text"]#ask-input:focus {
            border-color: #0b57d0;
            box-shadow: 0 0 0 2px rgba(11, 87, 208, 0.1);
        }

        .context-preview {
            font-size: 12px;
            color: #444746;
            background: #f0f4f9;
            padding: 8px 12px;
            border-radius: 8px;
            margin-bottom: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-shrink: 0;
            display: flex;
            align-items: center;
        }
        .context-preview.hidden { display: none; }
        .context-preview::before {
            content: "Context:";
            font-weight: 600;
            margin-right: 6px;
            color: #0b57d0;
        }
    `;
})();