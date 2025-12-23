
// services/providers/official.js

/**
 * Sends a message using the Official Google Gemini API.
 */
export async function sendOfficialMessage(prompt, systemInstruction, history, apiKey, modelName, thinkingLevel, files, signal, onUpdate) {
    if (!apiKey) throw new Error("API Key is missing.");
    
    // Dynamic Model Selection: Map UI values to API IDs
    let targetModel = modelName;
    
    // Default mapping if not specific
    if (!targetModel) targetModel = "gemini-3-flash-preview"; 

    // Explicit Mapping logic
    if (targetModel === 'gemini-3-flash') {
        targetModel = 'gemini-3-flash-preview';
    } else if (targetModel === 'gemini-3-flash-thinking') {
        targetModel = 'gemini-3-flash-preview'; // Flash with thinking intent
    } else if (targetModel === 'gemini-3-pro') {
        targetModel = 'gemini-3-pro-preview';
    }
    
    console.debug(`[Gemini Official API] Requesting ${targetModel} (Original: ${modelName})...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    // 1. Build Contents Array (History + Current Prompt)
    const contents = [];

    // Helper to format parts
    const formatPart = (msg) => {
        const parts = [];
        
        if (msg.role === 'ai') {
            // Model turn
            let signature = msg.thoughtSignature;
            
            // Gemini 3 requires thoughtSignature on parts.
            // If missing (legacy history), use dummy string for Gemini 3 to bypass strict validation.
            if (!signature && targetModel.includes("gemini-3")) {
                signature = "context_engineering_is_the_way_to_go";
            }

            if (msg.text !== undefined) {
                const part = { text: msg.text };
                if (signature) {
                    part.thoughtSignature = signature;
                }
                parts.push(part);
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
        
        return parts;
    };

    // Add History
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            const role = msg.role === 'ai' ? 'model' : 'user';
            const parts = formatPart(msg);
            if (parts.length > 0) {
                contents.push({ role, parts });
            }
        });
    }

    // Add Current Prompt
    const currentParts = [];
    if (prompt) currentParts.push({ text: prompt });
    
    if (files && files.length > 0) {
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
    
    contents.push({ role: 'user', parts: currentParts });

    const payload = {
        contents: contents,
        generationConfig: {
            temperature: 1.0, // Official recommendation: Lock to 1.0 to prevent reasoning degradation
        }
    };

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
                    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                        const parts = data.candidates[0].content.parts;
                        if (parts && parts.length > 0) {
                            parts.forEach(p => {
                                // Extract thoughts first (could be boolean flag + text, or string field)
                                if (p.thought === true && p.text) {
                                    fullThoughts += p.text;
                                } else if (typeof p.thought === 'string') {
                                    fullThoughts += p.thought;
                                } else if (p.text) {
                                    // Only add to fullText if NOT a thought
                                    fullText += p.text;
                                }
                                
                                if (p.thoughtSignature) {
                                    finalThoughtSignature = p.thoughtSignature;
                                }
                            });
                            
                            if (fullText || fullThoughts) {
                                onUpdate(fullText, fullThoughts);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore parse errors for incomplete chunks
                }
            }
        }
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null, 
        images: [], 
        context: null, // Stateless
        thoughtSignature: finalThoughtSignature
    };
}
