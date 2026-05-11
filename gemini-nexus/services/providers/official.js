// services/providers/official.js

function extractGroundingSources(groundingMetadata) {
    if (!groundingMetadata || !Array.isArray(groundingMetadata.groundingChunks)) {
        return [];
    }

    const sources = [];

    groundingMetadata.groundingChunks.forEach((chunk) => {
        const web = chunk && typeof chunk === 'object' ? chunk.web : null;
        if (!web || !web.uri) return;

        let title = web.title || web.uri;
        try {
            if (!web.title) {
                title = new URL(web.uri).hostname;
            }
        } catch (_) {}

        sources.push({
            title,
            url: web.uri
        });
    });

    return sources;
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return value;
    }
}

function hasNativePart(part) {
    return isPlainObject(part)
        && (part.text !== undefined
            || isPlainObject(part.functionCall)
            || isPlainObject(part.functionResponse)
            || isPlainObject(part.inlineData)
            || part.thought !== undefined
            || part.thoughtSignature !== undefined);
}

function cloneOfficialParts(parts) {
    if (!Array.isArray(parts)) return [];
    return parts
        .filter(hasNativePart)
        .map(part => cloneJson(part))
        .filter(Boolean);
}

function normalizeFunctionCall(part, partIndex) {
    const functionCall = part && isPlainObject(part.functionCall) ? part.functionCall : null;
    const name = typeof functionCall?.name === 'string' ? functionCall.name.trim() : '';
    if (!name) return null;

    return {
        id: typeof functionCall.id === 'string' ? functionCall.id : null,
        name,
        args: isPlainObject(functionCall.args) ? cloneJson(functionCall.args) : {},
        partIndex
    };
}

function buildMessageContent(msg, targetModel) {
    void targetModel;
    const fallbackRole = msg?.role === 'ai' ? 'model' : 'user';

    if (msg?.kind === 'tool-output' && msg.officialFunctionResponseBatchId) {
        return { role: fallbackRole, parts: [] };
    }

    const nativeContent = isPlainObject(msg?.officialContent) ? msg.officialContent : null;
    const nativeParts = nativeContent
        ? cloneOfficialParts(nativeContent.parts)
        : cloneOfficialParts(msg?.officialParts);

    if (nativeParts.length > 0) {
        return {
            role: nativeContent?.role === 'model' || nativeContent?.role === 'user'
                ? nativeContent.role
                : fallbackRole,
            parts: nativeParts
        };
    }

    const parts = [];

    if (msg.role === 'ai') {
        // Model turn. For Gemini 3 function-calling, thought signatures must
        // stay attached to their original native parts; legacy text-only
        // history can only preserve a single signature on the text part.
        if (msg.text !== undefined) {
            parts.push({ text: msg.text });
        }
    } else {
        // User turn
        if (msg.text) parts.push({ text: msg.text });

        // Add images if present
        if (msg.image && Array.isArray(msg.image)) {
            msg.image.forEach(img => {
                // img is base64 string "data:image/png;base64,..."
                const p = img.split(',');
                if (p.length === 2) {
                    const mimeMatch = p[0].match(/:(.*?);/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                    parts.push({
                        inlineData: { mimeType, data: p[1] }
                    });
                }
            });
        }
    }

    return { role: fallbackRole, parts };
}

export function extractOfficialResponseData(candidate) {
    const modelParts = [];
    const functionCalls = [];
    const seenFunctionCallIds = new Set();
    let text = "";
    let thoughts = "";
    let thoughtSignature = null;

    if (!candidate?.content || !Array.isArray(candidate.content.parts)) {
        return {
            text,
            thoughts,
            thoughtSignature,
            officialContent: null,
            functionCalls
        };
    }

    candidate.content.parts.forEach((part, partIndex) => {
        if (!isPlainObject(part)) return;

        modelParts.push(cloneJson(part));

        if (part.thought === true && part.text) {
            thoughts += part.text;
        } else if (typeof part.thought === 'string') {
            thoughts += part.thought;
        } else if (part.text) {
            text += part.text;
        }

        const functionCall = normalizeFunctionCall(part, partIndex);
        if (functionCall) {
            const key = functionCall.id || `${partIndex}:${functionCall.name}:${JSON.stringify(functionCall.args)}`;
            if (!seenFunctionCallIds.has(key)) {
                seenFunctionCallIds.add(key);
                functionCalls.push(functionCall);
            }
        }

        if (part.thoughtSignature) {
            thoughtSignature = part.thoughtSignature;
        }
    });

    return {
        text,
        thoughts,
        thoughtSignature,
        officialContent: modelParts.length > 0
            ? { role: candidate.content.role || 'model', parts: modelParts }
            : null,
        functionCalls
    };
}

/**
 * Sends a message using the Official Google Gemini API.
 */
export async function sendOfficialMessage(prompt, systemInstruction, history, config, thinkingLevel, files, enableWebSearch, signal, onUpdate) {
    let { baseUrl, apiKey, model: modelName, configuredModels } = config || {};
    if (!apiKey) throw new Error("API Key is missing.");
    if (!baseUrl) baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    
    // Dynamic Model Selection: Map UI values to API IDs
    let targetModel = modelName;
    
    if (!targetModel) {
        const configured = (configuredModels || "")
            .split(',')
            .map(m => m.trim())
            .filter(Boolean);
        targetModel = configured[0] || "gemini-3-flash-preview";
    }

    // Explicit Mapping logic
    if (targetModel === 'gemini-3-flash') {
        targetModel = 'gemini-3-flash-preview';
    } else if (targetModel === 'gemini-3-flash-thinking') {
        targetModel = 'gemini-3-flash-preview'; // Flash with thinking intent
    } else if (targetModel === 'gemini-3-pro') {
        targetModel = 'gemini-3-pro-preview';
    }
    
    console.debug(`[Gemini Official API] Requesting ${targetModel} (Original: ${modelName})...`);

    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const url = `${normalizedBaseUrl}/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    // 1. Build Contents Array (History + Current Prompt)
    const contents = [];

    // Add History
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            const content = buildMessageContent(msg, targetModel);
            if (content.parts.length > 0) {
                contents.push(content);
            }
        });
    }

    // Add Current Prompt
    const configuredCurrentParts = cloneOfficialParts(config?.officialUserParts);
    const currentParts = configuredCurrentParts.length > 0 ? configuredCurrentParts : [];
    if (configuredCurrentParts.length === 0 && prompt) currentParts.push({ text: prompt });

    if (configuredCurrentParts.length === 0 && files && files.length > 0) {
        files.forEach(f => {
             const parts = f.base64.split(',');
             const base64Data = parts[1];
             const mime = f.type || 'image/png';
             currentParts.push({
                 inlineData: {
                     mimeType: mime,
                     data: base64Data
                 }
             });
        });
    }

    if (currentParts.length > 0) {
        contents.push({ role: 'user', parts: currentParts });
    }

    const payload = {
        contents: contents,
        generationConfig: {
            temperature: 1.0 // Official recommendation: Lock to 1.0 to prevent reasoning degradation
        }
    };

    if (enableWebSearch) {
        payload.tools = [{ google_search: {} }];
    }

    // Apply Thinking Config if requested or user has configured it level
    // Specifically enable thinking for "Thinking" model variant
    if (modelName === 'gemini-3-flash-thinking' || thinkingLevel) {
        payload.generationConfig.thinkingConfig = {
            includeThoughts: true, // Ensure thoughts are returned in response
            thinkingLevel: thinkingLevel || "low" 
        };
    }

    // Add System Instruction if present
    if (systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    
    let buffer = "";
    let fullText = "";
    let fullThoughts = "";
    let finalThoughtSignature = null;
    const modelParts = [];
    const functionCalls = [];
    const sources = [];
    const seenSourceUrls = new Set();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        let lines = buffer.split('\n');
        buffer = lines.pop(); 
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.substring(6);
                try {
                    const data = JSON.parse(jsonStr);
                    const candidate = data.candidates && data.candidates[0] ? data.candidates[0] : null;

                    if (candidate && candidate.groundingMetadata) {
                        extractGroundingSources(candidate.groundingMetadata).forEach((source) => {
                            if (!source.url || seenSourceUrls.has(source.url)) return;
                            seenSourceUrls.add(source.url);
                            sources.push(source);
                        });
                    }

                    if (candidate && candidate.content) {
                        const parsed = extractOfficialResponseData(candidate);
                        if (parsed.officialContent) {
                            modelParts.push(...parsed.officialContent.parts);
                        }
                        if (parsed.functionCalls.length > 0) {
                            functionCalls.push(...parsed.functionCalls);
                        }
                        if (parsed.text) fullText += parsed.text;
                        if (parsed.thoughts) fullThoughts += parsed.thoughts;
                        if (parsed.thoughtSignature) finalThoughtSignature = parsed.thoughtSignature;

                        if (fullText || fullThoughts) {
                            onUpdate(fullText, fullThoughts);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors for incomplete chunks
                }
            }
        }
    }

    const seenCallIds = new Set();
    const dedupedFunctionCalls = functionCalls
        .filter(call => {
            if (!call?.id) return true;
            if (seenCallIds.has(call.id)) return false;
            seenCallIds.add(call.id);
            return true;
        });

    return {
        text: fullText,
        thoughts: fullThoughts || null, 
        sources,
        images: [], 
        context: null, // Stateless
        thoughtSignature: finalThoughtSignature,
        officialContent: modelParts.length > 0 ? { role: 'model', parts: modelParts } : null,
        functionCalls: dedupedFunctionCalls
    };
}
