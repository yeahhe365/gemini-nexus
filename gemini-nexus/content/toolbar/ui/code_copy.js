
(function() {
    /**
     * Handles copying code snippets from the result area.
     */
    class CodeCopyHandler {
        handle(e) {
            const btn = e.target.closest('.copy-code-btn');
            if (!btn) return;
            
            const wrapper = btn.closest('.code-block-wrapper');
            const codeEl = wrapper.querySelector('code');
            if (!codeEl) return;
            
            const text = codeEl.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalHtml = btn.innerHTML;
                // Simple feedback (Icon change)
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>`;
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            }).catch(err => console.error("Failed to copy text:", err));
        }
    }

    window.GeminiCodeCopyHandler = CodeCopyHandler;
})();
