function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);

    try {
        a.click();
    } finally {
        document.body.removeChild(a);
    }
}

export function downloadFile(url, filename) {
    triggerDownload(url, filename);
}

export function downloadText(text, filename, contentType = 'text/plain') {
    const blob = new Blob([text], { type: contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);

    try {
        triggerDownload(url, filename || 'download.txt');
    } finally {
        URL.revokeObjectURL(url);
    }
}
