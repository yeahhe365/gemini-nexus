const PAYLOAD_IDS_INDEX = 1;
const PAYLOAD_STRING_INDEX = 2;
const PAYLOAD_CANDIDATES_INDEX = 4;
const FIRST_CANDIDATE_INDEX = 0;
const CANDIDATE_CHOICE_ID_INDEX = 0;
const CANDIDATE_TEXT_INDEX = 1;
const CANDIDATE_THOUGHTS_INDEX = 37;
const TEXT_VALUE_INDEX = 0;
const CONVERSATION_ID_INDEX = 0;
const RESPONSE_ID_INDEX = 1;
const MAX_IMAGE_SCAN_DEPTH = 20;
const GENERATED_IMAGE_PLACEHOLDER_PATTERN =
    /https?:\/\/googleusercontent\.com\/image_generation_content\/\d+/;
const GENERATED_IMAGE_PLACEHOLDER_REPLACE_PATTERN =
    /https?:\/\/googleusercontent\.com\/image_generation_content\/\d+/g;

export function parseGeminiLine(line) {
    try {
        // Strip anti-hijacking prefix if present
        const cleanLine = line.replace(/^\)\]\}'/, '').trim();
        if (!cleanLine) return null;

        const rawData = JSON.parse(cleanLine);

        // The response should be an array (envelope)
        const rootArray = Array.isArray(rawData) ? rawData : null;
        if (!rootArray) return null;

        // Expected structure: [id, index, json_string, ...]
        const extractPayload = (item) => {
            if (!Array.isArray(item) || item.length <= PAYLOAD_STRING_INDEX) return null;

            // The payload is typically a JSON string at the payload string slot.
            const payloadStr = item[PAYLOAD_STRING_INDEX];
            if (typeof payloadStr !== 'string') return null;

            try {
                const payload = JSON.parse(payloadStr);

                // Payload structure typically:
                // [ [conv_id, resp_id], ..., null, null, [ [candidates] ] ]
                // The candidates bucket contains the first response candidate.
                if (!Array.isArray(payload) || payload.length <= PAYLOAD_CANDIDATES_INDEX) {
                    return null;
                }

                const candidates = payload[PAYLOAD_CANDIDATES_INDEX];
                if (!Array.isArray(candidates) || !candidates[FIRST_CANDIDATE_INDEX]) return null;

                // Candidate structure: [choiceId, [text_node], ...]
                const firstCandidate = candidates[FIRST_CANDIDATE_INDEX];
                if (
                    !Array.isArray(firstCandidate) ||
                    firstCandidate.length <= CANDIDATE_TEXT_INDEX
                ) {
                    return null;
                }

                // Extract the visible answer text.
                let text = '';
                const textNode = firstCandidate[CANDIDATE_TEXT_INDEX];
                if (Array.isArray(textNode) && typeof textNode[TEXT_VALUE_INDEX] === 'string') {
                    text = textNode[TEXT_VALUE_INDEX];
                }
                const hasTextGeneratedImagePlaceholder =
                    GENERATED_IMAGE_PLACEHOLDER_PATTERN.test(text);

                // Based on python gemini-webapi reference.
                let thoughts = null;
                const thoughtsBucket = firstCandidate[CANDIDATE_THOUGHTS_INDEX];
                if (
                    thoughtsBucket &&
                    Array.isArray(thoughtsBucket) &&
                    thoughtsBucket[TEXT_VALUE_INDEX]
                ) {
                    const thoughtNode = thoughtsBucket[TEXT_VALUE_INDEX];
                    if (
                        Array.isArray(thoughtNode) &&
                        typeof thoughtNode[TEXT_VALUE_INDEX] === 'string'
                    ) {
                        thoughts = thoughtNode[TEXT_VALUE_INDEX];
                    }
                }

                // Instead of relying on specific indices (which shift between models like Flash vs Thinking),
                // we recursively scan the candidate structure for any string that looks like a hosted image URL.
                const generatedImages = [];
                const seenUrls = new Set();
                let hasGeneratedImagePlaceholder = hasTextGeneratedImagePlaceholder;

                const traverse = (node, depth = 0) => {
                    // Guard against unexpected nested payloads.
                    if (!node || depth > MAX_IMAGE_SCAN_DEPTH) return;

                    if (typeof node === 'string') {
                        // Check for Google hosted content URLs (lh3.googleusercontent.com, etc.)
                        if (
                            (node.startsWith('http') || node.startsWith('//')) &&
                            (node.includes('googleusercontent.com') || node.includes('ggpht.com'))
                        ) {
                            // Exclude the placeholder URL which looks like .../image_generation_content/0.
                            if (node.includes('image_generation_content')) {
                                hasGeneratedImagePlaceholder = true;
                                return;
                            }

                            // Normalize protocol.
                            let url = node;
                            if (url.startsWith('//')) {
                                url = 'https:' + url;
                            } else if (url.startsWith('http://')) {
                                url = url.replace('http://', 'https://');
                            }

                            if (!seenUrls.has(url)) {
                                seenUrls.add(url);
                                generatedImages.push({
                                    url,
                                    alt: 'Generated Image',
                                });
                            }
                        }
                        return;
                    }

                    if (Array.isArray(node)) {
                        for (const childNode of node) {
                            traverse(childNode, depth + 1);
                        }
                        return;
                    }

                    if (typeof node === 'object') {
                        for (const key in node) {
                            traverse(node[key], depth + 1);
                        }
                        return;
                    }
                };

                // Start traversal on all properties of the candidate except the text node.
                // This prevents us from re-parsing URLs quoted in the text itself.
                firstCandidate.forEach((part, index) => {
                    if (index !== CANDIDATE_TEXT_INDEX) traverse(part);
                });

                // If real images were found, remove the ugly placeholder text.
                // Placeholder format: http://googleusercontent.com/image_generation_content/0
                if (generatedImages.length > 0) {
                    text = text.replace(GENERATED_IMAGE_PLACEHOLDER_REPLACE_PATTERN, '');
                    // Remove potential empty markdown links created by this removal.
                    text = text.replace(/\[\s*\]\(\s*\)/g, '');
                    text = text.trim();
                }

                return {
                    text,
                    thoughts,
                    images: generatedImages,
                    hasGeneratedImagePlaceholder,
                    conversationId: payload[PAYLOAD_IDS_INDEX]?.[CONVERSATION_ID_INDEX],
                    responseId: payload[PAYLOAD_IDS_INDEX]?.[RESPONSE_ID_INDEX],
                    choiceId: firstCandidate[CANDIDATE_CHOICE_ID_INDEX],
                };
            } catch {
                return null;
            }
        };

        // Iterate through all items in the envelope to find the one containing the chat payload
        // This handles cases where the 'wrb.fr' ID changes, moves, or the item index shifts
        for (const envelopeEntry of rootArray) {
            const result = extractPayload(envelopeEntry);
            if (result) {
                return {
                    text: result.text,
                    thoughts: result.thoughts,
                    images: result.images,
                    hasGeneratedImagePlaceholder: result.hasGeneratedImagePlaceholder,
                    ids: [result.conversationId, result.responseId, result.choiceId],
                };
            }
        }
    } catch {
        // Line parsing failed (not JSON or unexpected format)
    }
    return null;
}
