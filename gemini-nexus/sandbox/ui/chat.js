
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
        this.shouldFollowBottom = true;
        this.scrollFrame = null;
        this.resizeObserver = null;
        this.observedResizeElements = new WeakSet();

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

        // Code Block Copy Delegation
        if (this.historyDiv) {
            this.historyDiv.addEventListener('click', async (e) => {
                const link = e.target.closest('a[href]');
                if (link) {
                    const href = link.getAttribute('href');
                    if (href && /^https?:\/\//i.test(href)) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.parent.postMessage({
                            action: 'OPEN_EXTERNAL_URL',
                            payload: { url: href }
                        }, '*');
                        return;
                    }
                }

                const btn = e.target.closest('.copy-code-btn');
                if (!btn) return;
                
                const wrapper = btn.closest('.code-block-wrapper');
                const codeEl = wrapper.querySelector('code');
                if (!codeEl) return;
                
                try {
                    await copyToClipboard(codeEl.textContent);
                    
                    // Visual Feedback
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>`;
                    
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy code', err);
                }
            });
        }

        if (this.historyDiv) {
            this.historyDiv.addEventListener('scroll', () => this.handleHistoryScroll(), { passive: true });
            this.initScrollObservers();
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

    isNearBottom(threshold = 120) {
        if (!this.historyDiv) return null;

        const distanceFromBottom = this.historyDiv.scrollHeight
            - this.historyDiv.scrollTop
            - this.historyDiv.clientHeight;

        return distanceFromBottom <= threshold;
    }

    getScrollState() {
        if (!this.historyDiv) return null;

        return {
            scrollTop: this.historyDiv.scrollTop,
            scrollHeight: this.historyDiv.scrollHeight,
            clientHeight: this.historyDiv.clientHeight,
            isNearBottom: this.isNearBottom()
        };
    }

    handleHistoryScroll() {
        const isNearBottom = this.isNearBottom();
        if (isNearBottom !== null) {
            this.shouldFollowBottom = isNearBottom;
        }
    }

    initScrollObservers() {
        if (!this.historyDiv) return;

        if (typeof MutationObserver !== 'undefined') {
            const mutationObserver = new MutationObserver(() => {
                this.observeScrollableChildren();
                this.followStreamingContent();
            });
            mutationObserver.observe(this.historyDiv, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.followStreamingContent());
            this.resizeObserver.observe(this.historyDiv);
            this.observeScrollableChildren();
        }
    }

    observeScrollableChildren() {
        if (!this.resizeObserver || !this.historyDiv) return;

        Array.from(this.historyDiv.children).forEach((child) => {
            if (this.observedResizeElements.has(child)) return;
            this.observedResizeElements.add(child);
            this.resizeObserver.observe(child);
        });
    }

    scheduleBottomScroll(behavior = 'instant') {
        if (!this.historyDiv) return;
        if (this.scrollFrame !== null) return;

        this.scrollFrame = window.requestAnimationFrame(() => {
            this.scrollFrame = null;
            if (!this.historyDiv) return;
            this.historyDiv.scrollTo({
                top: this.historyDiv.scrollHeight,
                behavior
            });
        });
    }

    followStreamingContent() {
        if (!this.shouldFollowBottom) return;
        this.scheduleBottomScroll('instant');
    }

    restoreScrollState(state) {
        if (!this.historyDiv || !state) return;

        setTimeout(() => {
            if (state.isNearBottom) {
                this.shouldFollowBottom = true;
                this.scheduleBottomScroll('instant');
                return;
            }

            this.shouldFollowBottom = false;
            const maxScrollTop = Math.max(0, this.historyDiv.scrollHeight - this.historyDiv.clientHeight);
            this.historyDiv.scrollTop = Math.min(state.scrollTop, maxScrollTop);
        }, 50);
    }

    scrollToBottom(options = {}) {
        if (this.historyDiv) {
            setTimeout(() => {
                if (options.mode === 'bottom') {
                    this.shouldFollowBottom = true;
                    this.scheduleBottomScroll('instant');
                    return;
                }

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
