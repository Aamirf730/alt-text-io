/**
 * Get the base URL for API calls
 * Uses localhost for development, relative path for production
 */
export const getApiBase = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        return process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
    } else {
        // Production - use relative path
        return '/.netlify/functions';
    }
};

/**
 * Get authorization headers with Supabase session token
 */
export const getAuthHeaders = (accessToken) => {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };
};

/**
 * Convert blob URL or File to base64
 */
export const imageToBase64 = (imageSource) => {
    return new Promise((resolve, reject) => {
        if (typeof imageSource === 'string') {
            // It's a blob URL
            fetch(imageSource)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64Data = reader.result.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                })
                .catch(reject);
        } else if (imageSource instanceof File || imageSource instanceof Blob) {
            // It's a File or Blob object
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageSource);
        } else {
            reject(new Error('Invalid image source: must be blob URL, File, or Blob'));
        }
    });
};
