// content/toolbar/styles/index.js
(function() {
    const s = window.GeminiStyles || {};
    window.GeminiToolbarStyles = (s.Core || '') + (s.Widget || '') + (s.Panel || '') + (s.Markdown || '');
})();