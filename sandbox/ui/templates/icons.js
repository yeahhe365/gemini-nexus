function icon(strings, ...values) {
    return strings
        .reduce((html, chunk, index) => `${html}${chunk}${values[index] ?? ''}`, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export const TemplateIcons = {
    BROWSER_TAB: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <path d="M3 9h18"></path>
        </svg>
    `,
    BROWSER_CONTROL: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
            <path d="m13 13 6 6"></path>
        </svg>
    `,
    CHEVRON_LEFT: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    `,
    CHEVRON_RIGHT: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `,
    CLOSE: icon`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `,
    CHECK: icon`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#4caf50" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    `,
    COPY: icon`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `,
    DOWNLOAD: icon`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    `,
    EDIT: icon`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
    `,
    EXTERNAL_OPEN: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6"/>
            <path d="M10 14 21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        </svg>
    `,
    FIT_TO_SCREEN: icon`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
    `,
    GITHUB: icon`
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
            stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61
                c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77
                5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38
                0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0
                5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61
                6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
    `,
    HISTORY: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7"></path>
            <path d="M3 3v5h5"></path>
            <path d="M12 7v5l4 2"></path>
        </svg>
    `,
    SIDEBAR_TOGGLE: icon`
        <svg class="sidebar-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" x2="20" y1="8" y2="8"></line>
            <line x1="4" x2="14" y1="16" y2="16"></line>
        </svg>
    `,
    NEW_CHAT: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"></path>
        </svg>
    `,
    NEW_GROUP: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"></path>
            <path d="M2 8v11a2 2 0 0 0 2 2h14"></path>
        </svg>
    `,
    CHEVRON_DOWN: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    `,
    MORE_HORIZONTAL: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
        </svg>
    `,
    TRASH: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
        </svg>
    `,
    OCR: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7V4h3"></path>
            <path d="M20 7V4h-3"></path>
            <path d="M4 17v3h3"></path>
            <path d="M20 17v3h-3"></path>
            <line x1="9" y1="12" x2="15" y2="12"></line>
        </svg>
    `,
    PAGE_CONTEXT: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
    `,
    PAPERCLIP: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19
                a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
        </svg>
    `,
    QUOTE: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4
                c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2
                1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4
                c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2
                1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
        </svg>
    `,
    RELEASES: icon`
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
            stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
            <line x1="6" y1="1" x2="6" y2="4"></line>
            <line x1="10" y1="1" x2="10" y2="4"></line>
            <line x1="14" y1="1" x2="14" y2="4"></line>
        </svg>
    `,
    SEARCH: icon`
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="18"
            height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    `,
    SCREEN_CAPTURE: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="12" rx="2"></rect>
            <path d="M8 20h8"></path>
            <path d="M12 16v4"></path>
        </svg>
    `,
    SEND: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `,
    STOP: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="7" y="7" width="10" height="10" rx="1"></rect>
        </svg>
    `,
    SUMMARY: icon`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
            <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
            <path d="M10 12h4"></path>
            <path d="M10 16h4"></path>
        </svg>
    `,
    SETTINGS: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83
                2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33
                1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2
                2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4
                a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0
                2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82
                1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2
                2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9
                a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83
                2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9
                a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2
                2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51
                1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0
                2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9
                a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2
                2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    `,
    SHARE: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <path d="M8.59 13.51 15.42 17.49"></path>
            <path d="M15.41 6.51 8.59 10.49"></path>
        </svg>
    `,
    SNIP: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2v14a2 2 0 0 0 2 2h14"></path>
            <path d="M18 22V8a2 2 0 0 0-2-2H2"></path>
        </svg>
    `,
    TAB_STACK: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 6h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
            <path d="M2 6l2.5-3.5A2 2 0 0 1 6.1 1h11.8a2 2 0 0 1 1.6 1.5L22 6"/>
        </svg>
    `,
    ZAP: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
    `,
    TRANSLATE: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 8 6 6"></path>
            <path d="m4 14 6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="m22 22-5-10-5 10"></path>
            <path d="M14 18h6"></path>
        </svg>
    `,
    ZOOM_IN: icon`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `,
    ZOOM_OUT: icon`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `,
    PLUG: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 2v4"></path>
            <path d="M15 2v4"></path>
            <path d="M18 6H6a2 2 0 0 0-2 2v3a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6V8a2 2 0 0 0-2-2z"></path>
            <path d="M12 17v4"></path>
        </svg>
    `,
    KEY: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path>
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle>
        </svg>
    `,
    PALETTE: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 2 1 3 2.5 4.5.75.75 1.5 1.5 1.5 2.5.003 1.644 1.356 3 3 3H12z"></path>
            <circle cx="7.5" cy="10.5" r="1.5" stroke="none" fill="currentColor"></circle>
            <circle cx="11.5" cy="7.5" r="1.5" stroke="none" fill="currentColor"></circle>
            <circle cx="16.5" cy="9.5" r="1.5" stroke="none" fill="currentColor"></circle>
            <circle cx="15.5" cy="14.5" r="1.5" stroke="none" fill="currentColor"></circle>
        </svg>
    `,
    KEYBOARD: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M7 16h10M10 12h4"></path>
        </svg>
    `,
    LOCK_CLOSED: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
    `,
    LOCK_OPEN: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>
    `,
    INFO: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    `,
    PIN: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"></path>
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a3 3 0 0 1 .88-2.12l.83-.83A1 1 0 0 0 16 2H8a1 1 0 0 0-.71 1.71l.83.83A3 3 0 0 1 9 7z"></path>
        </svg>
    `,
    PIN_OFF: icon`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"></path>
            <path d="M15 10.34V7a3 3 0 0 1 .88-2.12l.71-.71"></path>
            <path d="m2 2 20 20"></path>
            <path d="M9 9.76v1a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"></path>
            <path d="M12.54 2H8a1 1 0 0 0-.71 1.71l.83.83A3 3 0 0 1 9 6.66"></path>
        </svg>
    `,
};
