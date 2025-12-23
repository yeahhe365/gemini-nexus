
// background/managers/image_manager.js

export class ImageManager {
    
    // Fetch image from a URL or Data URI
    async fetchImage(url) {
        try {
            if (url.startsWith('data:')) {
                const matches = url.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    return {
                        action: "FETCH_IMAGE_RESULT",
                        base64: url,
                        type: matches[1],
                        name: "dropped_image.png"
                    };
                }
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error("Fetch failed: " + response.statusText);
            
            const blob = await response.blob();
            // Convert blob to base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            return {
                action: "FETCH_IMAGE_RESULT",
                base64: base64,
                type: blob.type,
                name: "web_image.png"
            };

        } catch (e) {
            return {
                action: "FETCH_IMAGE_RESULT",
                error: e.message
            };
        }
    }

    // Internal helper for capturing visible tab
    _captureTab(windowId) {
        return new Promise((resolve) => {
            // Use explicit windowId if provided to ensure correct window is captured
            chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError || !dataUrl) {
                    console.error("Capture failed:", chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(dataUrl);
                }
            });
        });
    }

    // Capture the visible tab and return base64
    async captureScreenshot(windowId) {
        const dataUrl = await this._captureTab(windowId);
        
        if (!dataUrl) {
            return {
                action: "FETCH_IMAGE_RESULT",
                error: "Capture failed"
            };
        }
        
        return {
            action: "FETCH_IMAGE_RESULT",
            base64: dataUrl,
            type: "image/png",
            name: "screenshot.png"
        };
    }

    // Used when content script selects an area
    async captureArea(area, windowId) {
        const dataUrl = await this._captureTab(windowId);
        
        if (!dataUrl) {
            return null;
        }
        
        // Return data to UI for cropping
        return {
            action: "CROP_SCREENSHOT",
            image: dataUrl,
            area: area
        };
    }
}
