
// sandbox/render/pipeline.js
import { MathHandler } from './math_utils.js';

/**
 * Transforms raw text into HTML with Math placeholders protected/restored.
 * @param {string} text - Raw Markdown text
 * @returns {string} - HTML string
 */
export function transformMarkdown(text) {
    if (typeof marked === 'undefined') {
        // Library loads asynchronously; app will rerender when ready.
        // Return raw text in the meantime without polluting console.
        return text;
    }

    const mathHandler = new MathHandler();
    
    // 1. Protect Math blocks
    let processedText = mathHandler.protect(text || '');
    
    // 2. Parse Markdown
    let html = marked.parse(processedText);
    
    // 3. Restore Math blocks
    html = mathHandler.restore(html);
    
    return html;
}