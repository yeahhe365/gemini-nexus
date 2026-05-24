export const DEFAULT_WEB_MODEL = '8c46e95b1a07cecc';

const WEB_MODEL_OPTIONS = [
    { value: '8c46e95b1a07cecc', label: '3.1 Flash-Lite' },
    { value: '56fdd199312815e2', label: '3.5 Flash' },
    { value: 'e6fa609c3fa255c0', label: '3.1 Pro' },
];

const LEGACY_WEB_MODEL_ALIASES = {
    'gemini-2.5-flash': DEFAULT_WEB_MODEL,
    'gemini-3.1-flash-lite': DEFAULT_WEB_MODEL,
    'gemini-3-flash': DEFAULT_WEB_MODEL,
    'gemini-3.5-flash': '56fdd199312815e2',
    'gemini-3-flash-thinking': '56fdd199312815e2',
    'gemini-3.1-pro': 'e6fa609c3fa255c0',
    'gemini-3-pro': 'e6fa609c3fa255c0',
};

const WEB_MODEL_HEADER_CONFIGS = {
    '8c46e95b1a07cecc': {
        hash: '8c46e95b1a07cecc',
        mode: 6,
        featureMode: 1,
        fastThinkingLevel: 'minimal',
    },
    '56fdd199312815e2': {
        hash: '56fdd199312815e2',
        mode: 1,
        featureMode: 1,
        fastThinkingLevel: 'minimal',
    },
    e6fa609c3fa255c0: {
        hash: 'e6fa609c3fa255c0',
        mode: 3,
        featureMode: 1,
        fastThinkingLevel: 'low',
    },
};

function normalizeWebModel(model) {
    const normalized = String(model || DEFAULT_WEB_MODEL).trim();
    return LEGACY_WEB_MODEL_ALIASES[normalized] || normalized;
}

export function createWebModelOptions() {
    return WEB_MODEL_OPTIONS.map((option) => ({ ...option }));
}

export function createWebModelOptionMarkup() {
    return WEB_MODEL_OPTIONS.map(
        (option) => `<option value="${option.value}">${option.label}</option>`
    ).join('');
}

export function getWebModelHeaderConfig(model) {
    const normalized = normalizeWebModel(model);
    const config = WEB_MODEL_HEADER_CONFIGS[normalized];
    return config ? { ...config } : null;
}

export function getSupportedWebModelValues() {
    return Object.keys(WEB_MODEL_HEADER_CONFIGS);
}
