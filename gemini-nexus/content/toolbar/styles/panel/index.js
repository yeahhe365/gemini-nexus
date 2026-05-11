(function() {
    window.GeminiStyles = window.GeminiStyles || {};
    const s = window.GeminiStyles;
    
    // Combine modular styles into the main Panel property
    s.Panel = (s.PanelLayout || '') + 
              (s.PanelHeader || '') + 
              (s.PanelBody || '') + 
              (s.PanelFooter || '');
})();