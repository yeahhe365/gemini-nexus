(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    window.GeminiStyles.Core = `
        /* Shared Resets */
        button { font-family: inherit; }
        
        .view { display: flex; flex-direction: column; gap: 12px; }
        .view.hidden { display: none; }

        .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #c4c7c5;
            font-size: 13px;
            padding: 20px 0;
        }
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.1);
            border-top-color: #a8c7fa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;
})();