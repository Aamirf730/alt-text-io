// The generate endpoint rejects large request bodies, so images picked in the
// browser are scaled down and re-encoded as JPEG before they are sent.
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_MAX_BASE64_BYTES = 3 * 1024 * 1024;

export function getBase64PayloadSize(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;

  return Math.ceil((dataUrl.length - commaIndex - 1) * 3 / 4);
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
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('This browser could not prepare the image for generation.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (getBase64PayloadSize(dataUrl) <= IMAGE_MAX_BASE64_BYTES) {
        return dataUrl;
      }
    }

    width = Math.max(640, Math.round(width * 0.8));
    height = Math.max(640, Math.round(height * 0.8));
  }

  throw new Error('This image is too large to process. Please choose a smaller image.');
}
