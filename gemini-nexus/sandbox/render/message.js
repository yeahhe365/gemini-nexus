
// sandbox/render/message.js
import { renderContent } from './content.js';
import { copyToClipboard } from './clipboard.js';
import { createGeneratedImage } from './generated_image.js';
import { t } from '../core/i18n.js';

const MAX_VISIBLE_SOURCES = 2;

export function appendContextCompressionNotice(container, text, options = {}) {
    const div = document.createElement('div');
    div.className = 'context-compression-notice';
    div.setAttribute('role', 'status');

    const lineStart = document.createElement('span');
    lineStart.className = 'context-compression-line';

    const label = document.createElement('span');
    label.className = 'context-compression-label';

    const icon = document.createElement('span');
    icon.className = 'context-compression-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 12h4"></path><path d="M10 16h4"></path></svg>';

    const textSpan = document.createElement('span');
    textSpan.className = 'context-compression-text';
    textSpan.textContent = text;

    const lineEnd = document.createElement('span');
    lineEnd.className = 'context-compression-line';

    label.appendChild(icon);
    label.appendChild(textSpan);
    div.appendChild(lineStart);
    div.appendChild(label);
    div.appendChild(lineEnd);
    if (options.complete) {
        div.classList.add('context-compression-complete');
    }
    container.appendChild(div);

    if (options.scroll !== false) {
        setTimeout(() => {
            container.scrollTo({
                top: div.offsetTop - 20,
                behavior: 'smooth'
            });
        }, 10);
    }

    return {
        div,
        update: (nextText) => {
            textSpan.textContent = nextText;
            div.classList.add('context-compression-complete');
        }
    };
}

// Appends a message to the chat history and returns an update controller
// attachment can be:
// - string: single user image (URL/Base64)
// - array of strings: multiple user images
// - array of objects {url, alt}: AI generated images
export function appendMessage(container, text, role, attachment = null, thoughts = null, sources = null, options = {}) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    
    // Store current text state
    let currentText = text || "";
    let currentThoughts = thoughts || "";

    // 1. User Uploaded Images
    if (role === 'user' && attachment) {
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'user-images-grid';
        // Style inline for grid layout if multiple
        imagesContainer.style.display = 'flex';
        imagesContainer.style.flexWrap = 'wrap';
        imagesContainer.style.gap = '8px';
        imagesContainer.style.marginBottom = '8px';

        const imageSources = Array.isArray(attachment) ? attachment : [attachment];
        
        imageSources.forEach(src => {
            if (typeof src === 'string') {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'chat-image';
                
                // Allow full display by containing image within a reasonable box, or just auto
                if (imageSources.length > 1) {
                    img.style.maxWidth = '150px';
                    img.style.maxHeight = '200px'; 
                    img.style.width = 'auto';
                    img.style.height = 'auto';
                    img.style.objectFit = 'contain';
                    img.style.background = 'rgba(0,0,0,0.05)'; // Subtle background
                }
                
                // Click to enlarge
                img.addEventListener('click', () => {
                    document.dispatchEvent(new CustomEvent('gemini-view-image', { detail: src }));
                });
                imagesContainer.appendChild(img);
            }
        });
        
        if (imagesContainer.hasChildNodes()) {
            div.appendChild(imagesContainer);
        }
    }

    let contentDiv = null;
    let thoughtsDiv = null;
    let thoughtsContent = null;
    let sourcesDiv = null;
    let editCancel = null;

    const buildSourcesElement = (sourceList) => {
        if (role !== 'ai' || !Array.isArray(sourceList) || sourceList.length === 0) {
            return null;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'sources-container';

        const label = document.createElement('div');
        label.className = 'sources-label';
        label.textContent = t('sourcesLabel');
        wrapper.appendChild(label);

        const list = document.createElement('div');
        list.className = 'sources-list';

        let renderedCount = 0;

        sourceList.forEach((source, index) => {
            if (!source || !source.url) return;

            const link = document.createElement('a');
            link.className = 'source-link';
            if (index >= MAX_VISIBLE_SOURCES) {
                link.classList.add('source-link-hidden');
            }
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = source.title || source.url;
            list.appendChild(link);
            renderedCount++;
        });

        if (!list.childNodes.length) {
            return null;
        }

        wrapper.appendChild(list);

        if (renderedCount > MAX_VISIBLE_SOURCES) {
            const hiddenCount = renderedCount - MAX_VISIBLE_SOURCES;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'sources-toggle';

            const setToggleLabel = (expanded) => {
                toggle.textContent = expanded ? '▴' : '▾';
                const labelText = expanded
                    ? t('showLessSources')
                    : t('showMoreSources').replace('{count}', String(hiddenCount));
                toggle.title = labelText;
                toggle.setAttribute('aria-label', labelText);
                toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            };

            setToggleLabel(false);

            toggle.addEventListener('click', () => {
                const expanded = wrapper.classList.toggle('sources-expanded');
                setToggleLabel(expanded);
            });

            list.appendChild(toggle);
        }

        return wrapper;
    };

    // Allow creating empty AI bubbles for streaming
    if (currentText || currentThoughts || role === 'ai' || role === 'user') {
        
        // --- Thinking Process (Optional) ---
        if (role === 'ai') {
            thoughtsDiv = document.createElement('div');
            thoughtsDiv.className = 'thoughts-container';
            // Only show if we have thoughts
            if (!currentThoughts) thoughtsDiv.style.display = 'none';
            
            const details = document.createElement('details');
            if (currentThoughts) details.open = true; // Open by default if present initially
            
            const summary = document.createElement('summary');
            summary.textContent = "Thinking Process"; // Can be localized
            
            thoughtsContent = document.createElement('div');
            thoughtsContent.className = 'thoughts-content';
            renderContent(thoughtsContent, currentThoughts || "", 'ai');
            
            details.appendChild(summary);
            details.appendChild(thoughtsContent);
            thoughtsDiv.appendChild(details);
            div.appendChild(thoughtsDiv);
        }

        contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        renderContent(contentDiv, currentText, role);
        div.appendChild(contentDiv);

        if (role === 'ai' && Array.isArray(sources) && sources.length > 0) {
            sourcesDiv = buildSourcesElement(sources);
            if (sourcesDiv) {
                div.appendChild(sourcesDiv);
            }
        }

        // 2. AI Generated Images (Array of objects {url, alt})
        // Note: AI images are distinct from user attachments
        if (role === 'ai' && Array.isArray(attachment) && attachment.length > 0) {
            // Check if these are generated images (objects)
            if (typeof attachment[0] === 'object') {
                const grid = document.createElement('div');
                grid.className = 'generated-images-grid';
                
                // Only show the first generated image
                const firstImage = attachment[0];
                grid.appendChild(createGeneratedImage(firstImage));
                
                div.appendChild(grid);
            }
        }

        // --- Add Copy Button ---
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copy content';
        
        const copyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        copyBtn.innerHTML = copyIcon;

        copyBtn.addEventListener('click', async () => {
            try {
                // Use currentText closure to get latest streaming text
                await copyToClipboard(currentText);
                copyBtn.innerHTML = checkIcon;
                setTimeout(() => {
                    copyBtn.innerHTML = copyIcon;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });

        div.appendChild(copyBtn);

        if (role === 'user' && typeof options.onEdit === 'function') {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.title = t('editMessage');
            editBtn.setAttribute('aria-label', t('editMessage'));
            editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

            editBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (editCancel) return;

                div.classList.add('editing');
                contentDiv.style.display = 'none';
                copyBtn.style.display = 'none';
                editBtn.style.display = 'none';

                const editor = document.createElement('div');
                editor.className = 'message-edit';

                const textarea = document.createElement('textarea');
                textarea.className = 'message-edit-input';
                textarea.value = currentText;
                textarea.rows = Math.max(2, Math.min(8, currentText.split('\n').length));

                const actions = document.createElement('div');
                actions.className = 'message-edit-actions';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'message-edit-cancel';
                cancelBtn.textContent = t('cancelEdit');
                cancelBtn.title = t('cancelEdit');

                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.className = 'message-edit-save';
                saveBtn.title = t('saveEdit');
                saveBtn.setAttribute('aria-label', t('saveEdit'));
                saveBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

                actions.appendChild(cancelBtn);
                actions.appendChild(saveBtn);
                editor.appendChild(textarea);
                editor.appendChild(actions);
                div.insertBefore(editor, copyBtn);

                const cleanup = () => {
                    document.removeEventListener('pointerdown', handleOutsidePointer, true);
                    document.removeEventListener('keydown', handleDocumentKey, true);
                    editor.remove();
                    contentDiv.style.display = '';
                    copyBtn.style.display = '';
                    editBtn.style.display = '';
                    div.classList.remove('editing');
                    editCancel = null;
                };

                const cancel = () => {
                    cleanup();
                };

                let isSaving = false;

                const save = async () => {
                    if (isSaving) return;
                    const nextText = textarea.value.trim();
                    isSaving = true;
                    saveBtn.disabled = true;

                    try {
                        const accepted = await options.onEdit(nextText);
                        if (accepted !== false) {
                            cleanup();
                            return;
                        }
                    } catch (err) {
                        console.error('Failed to edit message:', err);
                    } finally {
                        isSaving = false;
                        saveBtn.disabled = false;
                    }
                };

                function handleOutsidePointer(pointerEvent) {
                    if (!div.contains(pointerEvent.target)) {
                        cancel();
                    }
                }

                function handleDocumentKey(keyEvent) {
                    if (keyEvent.key === 'Escape') {
                        keyEvent.preventDefault();
                        cancel();
                    }
                    if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        save();
                    }
                }

                cancelBtn.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    cancel();
                });

                saveBtn.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    save();
                });

                textarea.addEventListener('input', () => {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                });

                editCancel = cancel;

                setTimeout(() => {
                    document.addEventListener('pointerdown', handleOutsidePointer, true);
                    document.addEventListener('keydown', handleDocumentKey, true);
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                    textarea.dispatchEvent(new Event('input'));
                }, 0);
            });

            div.appendChild(editBtn);
        }
    }

    container.appendChild(div);
    
    // --- Scroll Logic ---
    // Instead of scrolling to bottom, we scroll to the top of the NEW message.
    // This allows users to read from the start while content streams in below.
    setTimeout(() => {
        const topPos = div.offsetTop - 20; // 20px padding context
        container.scrollTo({
            top: topPos,
            behavior: 'smooth'
        });
    }, 10);

    // Return controller
    return {
        div,
        update: (newText, newThoughts) => {
            if (newText !== undefined) {
                currentText = newText;
                if (contentDiv) {
                    renderContent(contentDiv, currentText, role);
                }
            }
            
            if (newThoughts !== undefined && thoughtsContent) {
                currentThoughts = newThoughts;
                renderContent(thoughtsContent, currentThoughts || "", 'ai');
                if (currentThoughts) {
                    thoughtsDiv.style.display = 'block';
                }
            }
            
            // Note: We removed the auto-scroll-to-bottom logic here.
            // If the user is at the start of the message, we want them to stay there
            // as the content expands downwards.
        },
        // Function to update images if they arrive late (though mostly synchronous in final reply)
        addImages: (images) => {
            if (Array.isArray(images) && images.length > 0 && !div.querySelector('.generated-images-grid')) {
                const grid = document.createElement('div');
                grid.className = 'generated-images-grid';
                
                // Only show the first generated image
                const firstImage = images[0];
                grid.appendChild(createGeneratedImage(firstImage));

                // Insert before copy button
                div.insertBefore(grid, div.querySelector('.copy-btn'));
                // Do not force scroll here either
            }
        },
        addSources: (sourceList) => {
            if (sourcesDiv || !Array.isArray(sourceList) || sourceList.length === 0) return;

            const builtSources = buildSourcesElement(sourceList);
            if (!builtSources) return;

            sourcesDiv = builtSources;
            const copyBtn = div.querySelector('.copy-btn');
            if (copyBtn) {
                div.insertBefore(sourcesDiv, copyBtn);
            } else {
                div.appendChild(sourcesDiv);
            }
        }
    };
}
