
// services/providers/openai_compatible.js

function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || '').replace(/\/$/, "");
}

function getFileBase64(files) {
    if (!Array.isArray(files)) return [];
    return files.map(file => file?.base64).filter(Boolean);
}

function normalizeMessageImages(message) {
    if (!message?.image || message.role !== 'user') return [];
    return Array.isArray(message.image) ? message.image.filter(Boolean) : [message.image];
}

function buildOpenAIContent(text, images) {
    if (!images || images.length === 0) {
        return text || "";
    }

    const content = [];
    if (text) {
        content.push({ type: "text", text: text });
    }

    images.forEach(img => {
        content.push({
            type: "image_url",
            image_url: {
                url: img
            }
        });
    });

    return content;
}

function buildResponsesContent(text, images) {
    if (!images || images.length === 0) {
        return text || "";
    }

    const content = [];
    if (text) {
        content.push({ type: "input_text", text: text });
    }

    images.forEach(img => {
        content.push({
            type: "input_image",
            image_url: img
        });
    });

    return content;
}

function buildChatMessages(prompt, systemInstruction, history, files) {
    const messages = [];

    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }

    if (Array.isArray(history)) {
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'ai' ? 'assistant' : 'user',
                content: buildOpenAIContent(msg.text, normalizeMessageImages(msg))
            });
        });
    }

    messages.push({
        role: "user",
        content: buildOpenAIContent(prompt, getFileBase64(files))
    });

    return messages;
}

function buildResponsesInput(prompt, history, files) {
    const input = [];

    if (Array.isArray(history)) {
        history.forEach(msg => {
            input.push({
                role: msg.role === 'ai' ? 'assistant' : 'user',
                content: buildResponsesContent(msg.text, normalizeMessageImages(msg))
            });
        });
    }

    input.push({
        role: "user",
        content: buildResponsesContent(prompt, getFileBase64(files))
    });

    return input;
}

function addSource(sources, seenSourceUrls, source) {
    const citation = source?.url_citation || source;
    const url = citation?.url || citation?.uri;
    if (!url || seenSourceUrls.has(url)) return;

    seenSourceUrls.add(url);
    sources.push({
        title: citation.title || url,
        url
    });
}

function extractSourcesFromAnnotation(annotation, sources, seenSourceUrls) {
    if (!annotation || annotation.type !== 'url_citation') return;
    addSource(sources, seenSourceUrls, annotation);
}

function extractSourcesFromResponseItem(item, sources, seenSourceUrls) {
    if (!item || typeof item !== 'object') return;

    const actionSources = item.action?.sources;
    if (Array.isArray(actionSources)) {
        actionSources.forEach(source => addSource(sources, seenSourceUrls, source));
    }

    if (!Array.isArray(item.content)) return;
    item.content.forEach(part => {
        if (Array.isArray(part?.annotations)) {
            part.annotations.forEach(annotation => extractSourcesFromAnnotation(annotation, sources, seenSourceUrls));
        }
    });
}

function extractTextFromCompletedResponse(responseObject) {
    if (!responseObject || !Array.isArray(responseObject.output)) return "";

    return responseObject.output
        .filter(item => item?.type === 'message' && Array.isArray(item.content))
        .flatMap(item => item.content)
        .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
        .map(part => part.text)
        .join("");
}

function extractReasoningSummaryFromResponseItem(item) {
    if (item?.type !== 'reasoning' || !Array.isArray(item.summary)) return "";

    return item.summary
        .filter(part => typeof part?.text === 'string')
        .map(part => part.text)
        .join("");
}

function extractReasoningSummaryFromCompletedResponse(responseObject) {
    if (!responseObject || !Array.isArray(responseObject.output)) return "";

    return responseObject.output
        .map(item => extractReasoningSummaryFromResponseItem(item))
        .join("");
}

async function readErrorMessage(response) {
    let errorText = await response.text();
    try {
        const errJson = JSON.parse(errorText);
        if (errJson.error && errJson.error.message) errorText = errJson.error.message;
    } catch(e) {}
    return errorText;
}

/**
 * Sends a message using an OpenAI Compatible API.
 */
export async function sendOpenAIMessage(prompt, systemInstruction, history, config, files, signal, onUpdate) {
    let { baseUrl, apiKey, model } = config;

    if (!baseUrl) throw new Error("Base URL is missing.");
    if (!model) throw new Error("Model ID is missing.");

    baseUrl = normalizeBaseUrl(baseUrl);
    const useResponsesApi = config?.useResponsesApi === true;
    const webSearch = config?.webSearch === true;
    if (useResponsesApi) {
        return sendOpenAIResponsesMessage(prompt, systemInstruction, history, { ...config, baseUrl, apiKey, model }, files, signal, onUpdate);
    }

    const url = `${baseUrl}/chat/completions`;

    const payload = {
        model: model,
        messages: buildChatMessages(prompt, systemInstruction, history, files),
        stream: true
    };

    if (config.reasoningEffort) {
        payload.reasoning_effort = config.reasoningEffort;
    }

    if (webSearch) {
        payload.web_search_options = {};
    }

    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const webSearchLabel = webSearch ? ' with Chat web search' : '';
    console.debug(`[OpenAI Compatible] Requesting ${model} at ${url}${webSearchLabel}...`);

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        const errorText = await readErrorMessage(response);
        throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const sources = [];
    const seenSourceUrls = new Set();
    
    let buffer = "";
    let fullText = "";
    let fullThoughts = ""; // Not standard in OpenAI, but some models (DeepSeek R1) might output <think> tags in content

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
                const dataStr = trimmed.substring(6);
                if (dataStr === '[DONE]') continue;
                
                try {
                    const data = JSON.parse(dataStr);
                    if (data.choices && data.choices.length > 0) {
                        const choice = data.choices[0];
                        const delta = choice.delta || {};
                        
                        // Standard Content
                        if (delta.content) {
                            fullText += delta.content;
                            onUpdate(fullText, fullThoughts);
                        }
                        
                        // Reasoning Content (DeepSeek R1 style or similar extension)
                        // If the API returns reasoning_content, use it as thoughts
                        if (delta.reasoning_content) {
                            fullThoughts += delta.reasoning_content;
                            onUpdate(fullText, fullThoughts);
                        }

                        if (Array.isArray(delta.annotations)) {
                            delta.annotations.forEach(annotation => extractSourcesFromAnnotation(annotation, sources, seenSourceUrls));
                        }

                        if (Array.isArray(choice.message?.annotations)) {
                            choice.message.annotations.forEach(annotation => extractSourcesFromAnnotation(annotation, sources, seenSourceUrls));
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null, 
        sources,
        images: [], 
        context: null 
    };
}

async function sendOpenAIResponsesMessage(prompt, systemInstruction, history, config, files, signal, onUpdate) {
    const { baseUrl, apiKey, model } = config;
    const url = `${baseUrl}/responses`;
    const payload = {
        model,
        input: buildResponsesInput(prompt, history, files),
        stream: true
    };

    if (config.webSearch === true) {
        payload.tools = [{ type: "web_search" }];
        payload.include = ["web_search_call.action.sources"];
    }

    if (systemInstruction) {
        payload.instructions = systemInstruction;
    }

    if (config.reasoningEffort) {
        payload.reasoning = {
            effort: config.reasoningEffort,
            summary: "detailed"
        };
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const webSearchLabel = config.webSearch === true ? ' with web search' : '';
    console.debug(`[OpenAI Responses] Requesting ${model} at ${url}${webSearchLabel}...`);

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        const errorText = await readErrorMessage(response);
        throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const sources = [];
    const seenSourceUrls = new Set();

    let buffer = "";
    let fullText = "";
    let fullThoughts = "";
    let streamError = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.substring(6);
            if (dataStr === '[DONE]') continue;

            try {
                const data = JSON.parse(dataStr);

                if (data.error?.message) {
                    streamError = data.error.message;
                    continue;
                }

                if (data.type === 'response.output_text.delta' && data.delta) {
                    fullText += data.delta;
                    onUpdate(fullText, fullThoughts);
                    continue;
                }

                if ((data.type === 'response.reasoning_summary_text.delta' || data.type === 'response.reasoning_text.delta') && data.delta) {
                    fullThoughts += data.delta;
                    onUpdate(fullText, fullThoughts);
                    continue;
                }

                if ((data.type === 'response.reasoning_summary_text.done' || data.type === 'response.reasoning_text.done') && data.text && !fullThoughts) {
                    fullThoughts = data.text;
                    onUpdate(fullText, fullThoughts);
                    continue;
                }

                if (data.type === 'response.output_text.annotation.added') {
                    extractSourcesFromAnnotation(data.annotation, sources, seenSourceUrls);
                    continue;
                }

                if (data.type === 'response.output_item.done') {
                    extractSourcesFromResponseItem(data.item, sources, seenSourceUrls);
                    if (!fullThoughts) {
                        const completedThoughts = extractReasoningSummaryFromResponseItem(data.item);
                        if (completedThoughts) {
                            fullThoughts = completedThoughts;
                            onUpdate(fullText, fullThoughts);
                        }
                    }
                    continue;
                }

                if (data.type === 'response.completed' && data.response) {
                    data.response.output?.forEach(item => extractSourcesFromResponseItem(item, sources, seenSourceUrls));
                    if (!fullThoughts) {
                        fullThoughts = extractReasoningSummaryFromCompletedResponse(data.response);
                    }
                    if (!fullText) {
                        fullText = extractTextFromCompletedResponse(data.response);
                    }
                    onUpdate(fullText, fullThoughts);
                }
            } catch (_) {
                // Ignore parse errors for incomplete or non-JSON stream lines.
            }
        }
    }

    if (streamError) {
        throw new Error(streamError);
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null,
        sources,
        images: [],
        context: null
    };
}
