
// content/toolbar/view/dom.js
(function() {
    const Templates = window.GeminiToolbarTemplates;

    class ToolbarDOM {
        constructor() {
            this.host = null;
            this.shadow = null;
        }

        create() {
            this.host = document.createElement('div');
            this.host.id = 'gemini-nexus-toolbar-host';
            Object.assign(this.host.style, {
                position: 'absolute', top: '0', left: '0', width: '0', height: '0',
                zIndex: '2147483647', pointerEvents: 'none'
            });
            document.documentElement.appendChild(this.host);
            this.shadow = this.host.attachShadow({ mode: 'closed' });
            
            this._render();
            this._loadMathLibs();
            
            return { host: this.host, shadow: this.shadow };
        }

        _render() {
            const container = document.createElement('div');
            container.innerHTML = Templates.mainStructure;
            this.shadow.appendChild(container);
        }

        _loadMathLibs() {
            // 1. Inject KaTeX CSS into Shadow DOM
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
            this.shadow.appendChild(link);
            
            const hljsLink = document.createElement('link');
            hljsLink.rel = 'stylesheet';
            hljsLink.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css';
            this.shadow.appendChild(hljsLink);
        }
    }

    window.GeminiToolbarDOM = ToolbarDOM;
})();
