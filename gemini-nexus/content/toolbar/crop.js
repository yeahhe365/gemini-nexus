
// content/toolbar/crop.js
(function() {
    window.GeminiImageCropper = {
        crop: function(base64, area) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const scale = area.pixelRatio || 1;
                    canvas.width = area.width * scale;
                    canvas.height = area.height * scale;
                    
                    ctx.drawImage(
                        img,
                        area.x * scale, area.y * scale, area.width * scale, area.height * scale,
                        0, 0, canvas.width, canvas.height
                    );
                    
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
                img.src = base64;
            });
        }
    };
})();
