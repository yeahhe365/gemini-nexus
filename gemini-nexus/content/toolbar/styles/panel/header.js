
(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    window.GeminiStyles.PanelHeader = `
        /* --- Standard Header Styles --- */

        .ask-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            cursor: move;
            user-select: none;
            background: #fff;
            flex-shrink: 0;
        }
        
        @media (max-width: 600px) {
            .ask-header {
                cursor: default; 
            }
        }

        .window-title {
            font-weight: 600;
            font-size: 15px;
            color: #1f1f1f;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 120px;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        /* Model Selector in Header */
        .ask-model-select {
            appearance: none;
            -webkit-appearance: none;
            background: #f0f4f9;
            border: 1px solid transparent;
            border-radius: 18px; /* Pill shape */
            padding: 0 12px;
            font-size: 13px;
            font-weight: 500;
            color: #444746;
            outline: none;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
            height: 32px;
            line-height: 30px; /* Ensure vertical centering */
            box-sizing: border-box;
            text-align: center;
            max-width: 140px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ask-model-select:hover {
            background: #e9eef6;
            color: #1f1f1f;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .ask-model-select option {
            background: #ffffff;
            color: #1f1f1f;
        }

        .icon-btn {
            background: transparent;
            border: none;
            color: #5e5e5e;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, color 0.2s;
        }
        .icon-btn:hover {
            background: #f0f1f1;
            color: #1f1f1f;
        }
    `;
})();
