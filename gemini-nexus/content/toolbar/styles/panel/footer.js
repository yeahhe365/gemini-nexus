(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    window.GeminiStyles.PanelFooter = `
        /* --- Footer Styles --- */
        
        .window-footer {
            flex-shrink: 0;
            background: #fff;
            padding: 8px 16px;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center; /* Centered by default for Stop button */
            box-sizing: border-box;
        }
        
        .window-footer.hidden { display: none; }

        .footer-actions {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .footer-actions.hidden { display: none; }

        .footer-left, .footer-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .footer-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            border-radius: 4px;
            color: #5e5e5e;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .footer-btn:hover {
            background: #f0f4f9;
            color: #0b57d0;
        }
        
        .footer-btn.text-btn {
            padding: 6px 10px;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
        }

        .footer-btn.text-btn.primary {
            background: #0b57d0;
            color: #fff;
        }
        .footer-btn.text-btn.primary:hover {
            background: #0842a0;
        }

        #btn-insert, #btn-replace {
            background: #e8f0fe;
            color: #0b57d0;
            border: 1px solid #0b57d0;
            border: 1px solid #0b57d0;
        }
        #btn-insert:hover, #btn-replace:hover {
            background: #d2e3fc;
        }

        .footer-stop {
            width: 100%;
            display: flex;
            justify-content: center;
        }
        .footer-stop.hidden { display: none; }

        .stop-pill-btn {
            background: #ffffff;
            color: #1f1f1f;
            border: 1px solid #e1e3e1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .stop-pill-btn:hover {
            background: #f8f9fa;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
        }
    `;
})();