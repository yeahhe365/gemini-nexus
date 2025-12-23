
// background/managers/log_manager.js

export class LogManager {
    constructor() {
        this.logs = [];
        this.MAX_LOGS = 5000; // Increased capacity for detailed debugging
        this.STORAGE_KEY = 'gemini_nexus_logs';
        this.init();
    }

    async init() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            if (result[this.STORAGE_KEY]) {
                this.logs = result[this.STORAGE_KEY];
            }
            // Avoid adding 'initialized' log here to prevent noise on every wake-up if not needed
        } catch (e) {
            console.error("Failed to load logs", e);
        }
    }

    add(entry) {
        if (!entry.timestamp) entry.timestamp = Date.now();
        
        this.logs.push(entry);
        
        // Prune if too large
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(-this.MAX_LOGS);
        }
        
        this._save();
    }

    _save() {
        // We rely on chrome.storage.local's efficiency
        chrome.storage.local.set({ [this.STORAGE_KEY]: this.logs }).catch(() => {});
    }

    getLogs() {
        return this.logs;
    }
    
    clear() {
        this.logs = [];
        this._save();
        this.add({ 
            level: 'INFO', 
            context: 'Background', 
            message: 'Logs cleared', 
            timestamp: Date.now() 
        });
    }
}

// --- Console Interception Helper ---

function safeStringify(obj) {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
        }
        return value;
    });
}

function formatConsoleArgs(args) {
    return args.map(arg => {
        if (arg instanceof Error) {
            return `[Error: ${arg.message}]\n${arg.stack}`;
        }
        if (typeof arg === 'object') {
            try {
                return safeStringify(arg);
            } catch (e) {
                return '[Object]';
            }
        }
        return String(arg);
    }).join(' ');
}

export function setupConsoleInterception(logManager) {
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug
    };

    ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
        console[level] = (...args) => {
            originalConsole[level](...args); // Keep original behavior in DevTools
            
            // Map console level to LogManager level
            let mgrLevel = 'INFO';
            if (level === 'warn') mgrLevel = 'WARN';
            if (level === 'error') mgrLevel = 'ERROR';
            if (level === 'debug') mgrLevel = 'DEBUG';

            // Filter out overly verbose logs if needed, but for now capture everything
            logManager.add({ 
                level: mgrLevel, 
                context: 'System', 
                message: formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };
    });
}
