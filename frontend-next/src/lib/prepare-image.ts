// The generate endpoint rejects large request bodies, so images picked in the
// browser are scaled down and re-encoded as JPEG before they are sent.
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_MAX_BASE64_BYTES = 3 * 1024 * 1024;
const IMAGE_SHRINK_FACTOR = 0.8;
const IMAGE_MIN_LONGEST_SIDE = 320;

export function getBase64PayloadSize(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;

  return Math.ceil((dataUrl.length - commaIndex - 1) * 3 / 4);
}

/**
 * The next, smaller size to try when an encoded image is still too large.
 * Both sides shrink by the same factor, so the aspect ratio is kept (a wide
 * banner stays wide). Returns null once the image cannot usefully shrink
 * further, so the caller stops instead of re-encoding the same size.
 */
export function getNextImageSize(width: number, height: number): { width: number; height: number } | null {
  if (Math.max(width, height) <= IMAGE_MIN_LONGEST_SIDE) return null;

  const next = {
    width: Math.max(1, Math.round(width * IMAGE_SHRINK_FACTOR)),
    height: Math.max(1, Math.round(height * IMAGE_SHRINK_FACTOR)),
  };
  return next.width === width && next.height === height ? null : next;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image could not be prepared for generation.'));
    };
    image.src = objectUrl;
  });
}

export async function prepareImageForUpload(file: File) {
  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const initialScale = Math.min(1, IMAGE_MAX_DIMENSION / longestSide);
  let size: { width: number; height: number } | null = {
    width: Math.max(1, Math.round(image.naturalWidth * initialScale)),
    height: Math.max(1, Math.round(image.naturalHeight * initialScale)),
  };

  while (size) {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('This browser could not prepare the image for generation.');
    }

    // JPEG has no transparency: without a background, transparent pixels
    // (a logo on a transparent PNG) would turn black and hide the image.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (getBase64PayloadSize(dataUrl) <= IMAGE_MAX_BASE64_BYTES) {
        return dataUrl;
      }
    }

    size = getNextImageSize(size.width, size.height);
  }

  throw new Error('This image is too large to process. Please choose a smaller image.');
}
