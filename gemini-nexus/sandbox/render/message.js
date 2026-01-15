
// sandbox/render/message.js
import { renderContent } from './content.js';
import { copyToClipboard } from './clipboard.js';
import { createGeneratedImage } from './generated_image.js';

// Appends a message to the chat history and returns an update controller
// attachment can be:
// - string: single user image (URL/Base64)
// - array of strings: multiple user images
// - array of objects {url, alt}: AI generated images
export function appendMessage(container, text, role, attachment = null, thoughts = null, messageIndex = null) {
    console.log(`[appendMessage] role=${role}, messageIndex=${messageIndex}, hasAttachment=${!!attachment}`);
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

    // --- Thinking Process (Optional) ---
    if (role === 'ai' && (currentText || currentThoughts)) {
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

    // Render Content
    if (currentText || currentThoughts || role === 'ai') {
        contentDiv = document.createElement('div');
        renderContent(contentDiv, currentText, role);
        div.appendChild(contentDiv);

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
    }

    // --- Add Message Action Buttons ---
    if (role === 'ai') {
        // For AI messages: Create a button container below message content
        const aiButtonContainer = document.createElement('div');
        aiButtonContainer.className = 'ai-message-actions';

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copy content';

        const copyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        copyBtn.innerHTML = copyIcon;

        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
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

        aiButtonContainer.appendChild(copyBtn);

        // Add Regenerate Button if messageIndex is provided
        if (messageIndex !== null && messageIndex !== undefined) {
            const regenerateBtn = document.createElement('button');
            regenerateBtn.className = 'regenerate-btn';
            regenerateBtn.title = 'Regenerate response';

            const regenerateIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
            regenerateBtn.innerHTML = regenerateIcon;

            regenerateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.dispatchEvent(new CustomEvent('regenerate-message', {
                    detail: { messageIndex }
                }));
            });

            aiButtonContainer.appendChild(regenerateBtn);
        }

        div.appendChild(aiButtonContainer);
    } else if (role === 'user' && messageIndex !== null && messageIndex !== undefined) {
        // For user messages: Continue using the action buttons container on the left
        const actionButtons = document.createElement('div');
        actionButtons.className = 'user-message-actions';

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn copy-btn';
        copyBtn.title = 'Copy content';

        const copyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        copyBtn.innerHTML = copyIcon;

        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
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

        actionButtons.appendChild(copyBtn);

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.title = 'Edit message';

        const editIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        editBtn.innerHTML = editIcon;

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.dispatchEvent(new CustomEvent('edit-message', {
                detail: { messageIndex }
            }));
        });

        actionButtons.appendChild(editBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.title = 'Delete message';

        const deleteIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.innerHTML = deleteIcon;

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this message?')) {
                document.dispatchEvent(new CustomEvent('delete-message', {
                    detail: { messageIndex }
                }));
            }
        });

        actionButtons.appendChild(deleteBtn);

        div.appendChild(actionButtons);
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
        }
    };
}
