
// ui_chat.js -> sandbox/ui/chat.js
import { t } from '../core/i18n.js';
import { copyToClipboard } from '../render/clipboard.js';

export class ChatController {
    constructor(elements) {
        this.historyDiv = elements.historyDiv;
        this.statusDiv = elements.statusDiv;
        this.inputFn = elements.inputFn;
        this.sendBtn = elements.sendBtn;
        this.pageContextBtn = document.getElementById('page-context-btn');

        this.initListeners();
    }

    initListeners() {
        // Auto-resize Textarea
        if (this.inputFn) {
            this.inputFn.addEventListener('input', () => {
                this.inputFn.style.height = 'auto';
                this.inputFn.style.height = this.inputFn.scrollHeight + 'px';
            });
        }

        // Code Block Copy/Preview Delegation
        if (this.historyDiv) {
            this.historyDiv.addEventListener('click', async (e) => {
                // Handle Copy Button
                const copyBtn = e.target.closest('.copy-code-btn');
                if (copyBtn) {
                    const wrapper = copyBtn.closest('.code-block-wrapper');
                    const codeEl = wrapper.querySelector('code');
                    if (!codeEl) return;

                    try {
                        await copyToClipboard(codeEl.textContent);

                        // Visual Feedback
                        const originalHtml = copyBtn.innerHTML;
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>`;

                        setTimeout(() => {
                            copyBtn.innerHTML = originalHtml;
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy code', err);
                    }
                    return;
                }

                // Handle Preview Button
                const previewBtn = e.target.closest('.preview-code-btn');
                if (previewBtn) {
                    const wrapper = previewBtn.closest('.code-block-wrapper');
                    const codeEl = wrapper?.querySelector('code');
                    if (codeEl) {
                        this.openHtmlPreview(codeEl.textContent);
                    }
                }
            });
        }
    }

    // Open HTML Preview Drawer
    openHtmlPreview(htmlContent) {
        // Remove existing drawer if any
        this.closeHtmlPreview();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'html-preview-overlay';

        // Create drawer
        const drawer = document.createElement('div');
        drawer.className = 'html-preview-drawer';
        drawer.innerHTML = `
            <div class="html-preview-drawer-header">
                <h3>${t('htmlPreview')}</h3>
                <button class="html-preview-drawer-close" aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="html-preview-drawer-content">
                <iframe sandbox="allow-scripts"></iframe>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        // Set iframe content
        const iframe = drawer.querySelector('iframe');
        iframe.srcdoc = htmlContent;

        // Close button handler
        drawer.querySelector('.html-preview-drawer-close').addEventListener('click', () => {
            this.closeHtmlPreview();
        });

        // Overlay click to close (delayed to avoid same-click closure)
        setTimeout(() => {
            overlay.addEventListener('click', () => this.closeHtmlPreview());
        }, 50);

        // Trigger animation after DOM update
        setTimeout(() => {
            overlay.classList.add('open');
            drawer.classList.add('open');
        }, 10);
    }

    // Close HTML Preview Drawer
    closeHtmlPreview() {
        const overlay = document.querySelector('.html-preview-overlay');
        const drawer = document.querySelector('.html-preview-drawer');

        if (overlay) {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 300);
        }
        if (drawer) {
            drawer.classList.remove('open');
            setTimeout(() => drawer.remove(), 300);
        }
    }

    updateStatus(text) {
        if (this.statusDiv) {
            this.statusDiv.innerText = text;
        }
    }

    clear() {
        if (this.historyDiv) this.historyDiv.innerHTML = '';
    }

    scrollToBottom() {
        if (this.historyDiv) {
            setTimeout(() => {
                // Scroll to the start of the last message to ensure visibility from the beginning
                const lastMsg = this.historyDiv.lastElementChild;
                if (lastMsg) {
                    this.historyDiv.scrollTo({
                        top: lastMsg.offsetTop - 20,
                        behavior: 'smooth'
                    });
                } else {
                    this.historyDiv.scrollTop = this.historyDiv.scrollHeight;
                }
            }, 50);
        }
    }

    resetInput() {
        if (this.inputFn) {
            this.inputFn.value = '';
            this.inputFn.style.height = 'auto'; // Reset height only once
            this.inputFn.focus();
        }
    }

    togglePageContext(isActive) {
        if (this.pageContextBtn) {
            this.pageContextBtn.classList.toggle('active', isActive);
        }
    }

    setLoading(isLoading) {
        // Toggle button between Send and Stop
        if(isLoading) {
            this.updateStatus(""); // Clear status text, only show spinner
            if (this.statusDiv) this.statusDiv.classList.add('thinking');

            if (this.sendBtn) {
                // Stop Icon (Square)
                this.sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>';
                this.sendBtn.title = t('stopGenerating');
                this.sendBtn.classList.add('generating');
            }
        } else {
            this.updateStatus("");
            if (this.statusDiv) this.statusDiv.classList.remove('thinking');

            if (this.sendBtn) {
                // Send Icon (Paper plane)
                this.sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
                this.sendBtn.title = t('sendMessage');
                this.sendBtn.disabled = false;
                this.sendBtn.classList.remove('generating');
            }
        }
    }
}
