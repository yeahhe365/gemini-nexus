// sandbox/controllers/session_flow.js
import { appendMessage } from '../render/message.js';
import { sendToBackground, saveSessionsToStorage } from '../../lib/messaging.js';
import { t } from '../core/i18n.js';
import { exportSession } from '../utils/export.js';

export class SessionFlowController {
    constructor(sessionManager, uiController, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.app = appController;
    }

    handleNewChat() {
        if (this.app.isGenerating) this.app.prompt.cancel();

        this.app.messageHandler.resetStream();

        const s = this.sessionManager.createSession();
        s.title = t('newChat');
        this.switchToSession(s.id);
    }

    switchToSession(sessionId) {
        if (this.app.isGenerating) this.app.prompt.cancel();

        this.app.messageHandler.resetStream();
        this.sessionManager.setCurrentId(sessionId);

        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        this.ui.clearChatHistory();
        session.messages.forEach((msg, index) => {
            let attachment = null;
            if (msg.role === 'user') attachment = msg.image;
            if (msg.role === 'ai') attachment = msg.generatedImages;
            // Pass msg.thoughts and index to appendMessage
            appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index);
        });
        this.ui.scrollToBottom();

        if (session.context) {
            sendToBackground({
                action: "SET_CONTEXT",
                context: session.context,
                model: this.app.getSelectedModel()
            });
        } else {
            sendToBackground({ action: "RESET_CONTEXT" });
        }

        this.refreshHistoryUI();
        this.ui.resetInput();
    }

    refreshHistoryUI() {
        this.ui.renderHistoryList(
            this.sessionManager.getSortedSessions(),
            this.sessionManager.currentSessionId,
            {
                onSwitch: (id) => this.switchToSession(id),
                onDelete: (id) => this.handleDeleteSession(id),
                onExport: (id) => this.handleExportSession(id)
            }
        );
    }

    handleDeleteSession(sessionId) {
        const switchNeeded = this.sessionManager.deleteSession(sessionId);
        saveSessionsToStorage(this.sessionManager.sessions);

        if (switchNeeded) {
            if (this.sessionManager.sessions.length > 0) {
                this.switchToSession(this.sessionManager.currentSessionId);
            } else {
                this.handleNewChat();
            }
        } else {
            this.refreshHistoryUI();
        }
    }

    handleExportSession(sessionId) {
        const session = this.sessionManager.sessions.find(s => s.id === sessionId);
        if (session) {
            exportSession(session);
            // Optional: Show a brief status message
            this.ui.updateStatus(t('exportSuccess'));
            setTimeout(() => this.ui.updateStatus(''), 2000);
        }
    }

    handleExportCurrentSession() {
        const session = this.sessionManager.getCurrentSession();
        if (session && session.messages && session.messages.length > 0) {
            exportSession(session);
            this.ui.updateStatus(t('exportSuccess'));
            setTimeout(() => this.ui.updateStatus(''), 2000);
        } else {
            this.ui.updateStatus(t('noMessagesToExport'));
            setTimeout(() => this.ui.updateStatus(''), 2000);
        }
    }

    handleDeleteMessage(messageIndex) {
        const session = this.sessionManager.getCurrentSession();
        if (!session || !session.messages[messageIndex]) return;

        // Delete the message
        this.sessionManager.deleteMessage(session.id, messageIndex);

        // Clear and re-render the chat history
        this.ui.clearChatHistory();
        session.messages.forEach((msg, index) => {
            let attachment = null;
            if (msg.role === 'user') attachment = msg.image;
            if (msg.role === 'ai') attachment = msg.generatedImages;
            appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index);
        });

        saveSessionsToStorage(this.sessionManager.sessions);
    }

    handleEditMessage(messageIndex) {
        const session = this.sessionManager.getCurrentSession();
        if (!session || !session.messages[messageIndex]) return;

        const message = session.messages[messageIndex];
        if (message.role !== 'user') return; // Only user messages can be edited

        // Calculate how many messages will be deleted
        const subsequentMessages = session.messages.length - messageIndex - 1;

        // Store the original message text for potential cancel
        this.editingMessageData = {
            messageIndex,
            originalText: message.text
        };

        // Set the input value to the message text
        this.ui.inputFn.value = message.text;
        this.ui.inputFn.focus();

        // Clear the image when editing a message
        this.app.imageManager.clearFile();

        // Update status to show editing mode with deletion warning
        const statusMsg = subsequentMessages > 0
            ? `Editing message ${messageIndex} (will delete ${subsequentMessages} subsequent messages)... (press Esc to cancel)`
            : 'Editing message... (press Esc to cancel)';
        this.ui.updateStatus(statusMsg);

        // Store the cancel handler
        const cancelEdit = () => {
            if (this.editingMessageData) {
                // Restore original text if canceled
                this.ui.inputFn.value = this.editingMessageData.originalText;
            }
            this.cancelEdit();
        };

        // Listen for Escape key to cancel
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                cancelEdit();
            }
        };

        this.ui.inputFn.addEventListener('keydown', handleKeyDown, { once: true });
    }

    cancelEdit() {
        if (this.editingMessageData) {
            this.editingMessageData = null;
            this.ui.updateStatus('');
        }
        // Also clear the prompt controller's editing state
        if (this.app && this.app.prompt) {
            this.app.prompt.isEditing = false;
            this.app.prompt.editMessageIndex = null;
        }
    }

    handleRegenerateMessage(messageIndex) {
        console.log('🔄 handleRegenerateMessage called with index:', messageIndex);

        if (this.app.isGenerating) {
            console.log('❌ Cannot regenerate: already generating');
            return;
        }

        const session = this.sessionManager.getCurrentSession();
        if (!session || !session.messages[messageIndex]) {
            console.log('❌ Cannot regenerate: session or message not found');
            return;
        }

        const message = session.messages[messageIndex];
        console.log('📄 Message to regenerate:', message);

        if (message.role !== 'ai') {
            console.log('❌ Cannot regenerate: not an AI message');
            return; // Only regenerate AI messages
        }

        // Find the corresponding user message (should be the one before)
        const userMessageIndex = messageIndex - 1;
        if (userMessageIndex < 0 || session.messages[userMessageIndex].role !== 'user') {
            console.log('❌ Cannot regenerate: no corresponding user message');
            return;
        }

        const userMessage = session.messages[userMessageIndex];
        console.log('👤 User message to use for regeneration:', userMessage);

        // Cancel any ongoing generation
        if (this.app.isGenerating) {
            this.app.prompt.cancel();
        }

        // Remove the AI message AND all subsequent messages from session
        // This ensures context consistency after regeneration
        const messagesToRemove = session.messages.length - messageIndex;
        console.log(`[handleRegenerateMessage] Removing ${messagesToRemove} messages starting from index ${messageIndex}`);
        session.messages.splice(messageIndex, messagesToRemove);
        console.log('[handleRegenerateMessage] After removal, session.messages.length:', session.messages.length);

        // Store regeneration info so we know where to insert the new response
        this.app.prompt.isRegenerating = true;
        this.app.prompt.regenerateIndex = messageIndex; // This is where the new AI response should be inserted
        this.app.prompt.regenerateUserMessageIndex = userMessageIndex;

        // Show status message to inform user
        const messagesRemoved = messagesToRemove;
        const statusMsg = messagesRemoved > 1
            ? `Regenerating from message ${messageIndex} (deleting ${messagesRemoved} subsequent messages)...`
            : `Regenerating message ${messageIndex}...`;
        this.ui.updateStatus(statusMsg);

        // Clear and re-render the chat history (without the removed messages)
        this.ui.clearChatHistory();
        session.messages.forEach((msg, index) => {
            let attachment = null;
            if (msg.role === 'user') attachment = msg.image;
            if (msg.role === 'ai') attachment = msg.generatedImages;
            appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index);
        });

        // Set the user message text in the input field
        this.ui.inputFn.value = userMessage.text;
        console.log('📝 Set input value to:', userMessage.text);

        // Set the image if there was one
        if (userMessage.image) {
            this.app.imageManager.setFile(userMessage.image, 'image/png', 'image.png');
            console.log('🖼️ Set image file');
        }

        // Clear edit mode if any
        if (this.editingMessageData) {
            this.cancelEdit();
        }

        // Send the user message again to regenerate the AI response
        // Skip rendering and adding user message since it already exists
        console.log('⚡ About to call prompt.send()');
        setTimeout(() => {
            console.log('🚀 Calling prompt.send(true, true)');
            this.app.prompt.send(true, true);
            console.log('✅ prompt.send() called');
        }, 100);

        saveSessionsToStorage(this.sessionManager.sessions);
        console.log('💾 Saved sessions to storage');
    }
}
