import { loadLibs } from './loader.js';
import { transformMarkdown } from '../render/pipeline.js';
import { WatermarkRemover } from '../../shared/media/watermark_remover.js';
import { createPrefixedId, getHighResImageUrl } from '../../shared/utils/index.js';
import { t } from '../core/i18n.js';

let rendererMessageHandler = null;

function escapeAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function initRendererMode() {
    document.body.innerHTML = ''; // Clear UI

    const dependencyLoadPromise = loadLibs();

    if (rendererMessageHandler) {
        window.removeEventListener('message', rendererMessageHandler);
    }

    rendererMessageHandler = async (event) => {
        const message = event.data || {};
        if (!message || typeof message !== 'object') return;

        if (message.action === 'RENDER') {
            const { text, reqId, images } = message;

            try {
                await dependencyLoadPromise;

                let html = transformMarkdown(text);

                if (typeof katex !== 'undefined') {
                    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, content) => {
                        try {
                            return katex.renderToString(content, {
                                displayMode: true,
                                throwOnError: false,
                            });
                        } catch {
                            return match;
                        }
                    });
                    html = html.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$/g, (match, content) => {
                        try {
                            return katex.renderToString(content, {
                                displayMode: false,
                                throwOnError: false,
                            });
                        } catch {
                            return match;
                        }
                    });
                }

                const fetchTasks = [];
                if (images && Array.isArray(images) && images.length > 0) {
                    let imageHtml = '<div class="generated-images-grid">';
                    const displayImages = images.filter(
                        (imageData) =>
                            imageData &&
                            typeof imageData === 'object' &&
                            typeof imageData.url === 'string'
                    );

                    displayImages.forEach((imageData) => {
                        const imageRequestId = createPrefixedId('gen_img');
                        const targetUrl = getHighResImageUrl(imageData.url);
                        const alt = escapeAttribute(imageData.alt || t('generatedImage'));

                        imageHtml += `<img class="generated-image loading" alt="${alt}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjwvc3ZnPg==" data-req-id="${imageRequestId}">`;

                        fetchTasks.push({ reqId: imageRequestId, url: targetUrl });
                    });
                    imageHtml += '</div>';
                    html += imageHtml;
                }

                event.source.postMessage(
                    { action: 'RENDER_RESULT', html, reqId, fetchTasks },
                    { targetOrigin: '*' }
                );
            } catch (error) {
                console.error('Render error', error);
                event.source.postMessage(
                    { action: 'RENDER_RESULT', html: text, reqId },
                    { targetOrigin: '*' }
                );
            }
        }

        if (message.action === 'PROCESS_IMAGE') {
            const { base64, reqId } = message;
            try {
                const result = await WatermarkRemover.process(base64);
                event.source.postMessage(
                    { action: 'PROCESS_IMAGE_RESULT', base64: result, reqId },
                    { targetOrigin: '*' }
                );
            } catch (error) {
                console.warn('Watermark removal failed in renderer', error);
                event.source.postMessage(
                    { action: 'PROCESS_IMAGE_RESULT', base64, reqId, error: error.message },
                    { targetOrigin: '*' }
                );
            }
        }
    };

    window.addEventListener('message', rendererMessageHandler);
}
