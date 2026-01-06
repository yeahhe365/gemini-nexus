(function() {
    try {
        const params = new URLSearchParams(window.location.search);
        const theme = params.get('theme');
        const lang = params.get('lang');
        const inPip = params.get('inPip') === 'true';
        const systemTheme = params.get('systemTheme'); // 'dark' | 'light'

        console.log('[ThemeInit] URL:', window.location.href);
        console.log('[ThemeInit] Theme param:', theme);
        console.log('[ThemeInit] Lang param:', lang);
        if (inPip) console.log('[ThemeInit] PIP context:', { systemTheme });

        // Apply Theme
        // IMPORTANT: Explicitly set data-theme for both light and dark
        if (theme === 'light') {
            // Explicitly set light theme
            console.log('[ThemeInit] Setting light theme');
            document.documentElement.setAttribute('data-theme', 'light');
            console.log('[ThemeInit] data-theme attribute:', document.documentElement.getAttribute('data-theme'));
        } else if (theme === 'dark') {
            // Explicitly set dark theme
            console.log('[ThemeInit] Setting dark theme');
            document.documentElement.setAttribute('data-theme', 'dark');
            console.log('[ThemeInit] data-theme attribute:', document.documentElement.getAttribute('data-theme'));
        } else if (theme === 'system') {
            // Resolve system theme (prefer explicit PIP override if present)
            const resolved = (inPip && (systemTheme === 'dark' || systemTheme === 'light'))
                ? systemTheme
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            console.log('[ThemeInit] System theme resolved:', resolved);
            document.documentElement.setAttribute('data-theme', resolved);
            console.log('[ThemeInit] data-theme attribute:', document.documentElement.getAttribute('data-theme'));
        } else {
            // Default fallback
            console.log('[ThemeInit] No theme param, using fallback');
            const resolved = (inPip && (systemTheme === 'dark' || systemTheme === 'light'))
                ? systemTheme
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            console.log('[ThemeInit] System theme resolved:', resolved);
            document.documentElement.setAttribute('data-theme', resolved);
            console.log('[ThemeInit] data-theme attribute:', document.documentElement.getAttribute('data-theme'));
        }

        // Apply Language
        if (lang && lang !== 'system') {
            document.documentElement.lang = lang;
        } else if (!lang || lang === 'system') {
            if (navigator.language.startsWith('zh')) {
                 document.documentElement.lang = 'zh';
            }
        }
    } catch(e) {
        console.error('[ThemeInit] Error:', e);
    }
})();
