const ACCEPTED = ['image/png', 'image/jpeg'];

/**
 * Read a picked PNG/JPEG and return a JPEG data URL no larger than `maxSize` px on its longest
 * side — passport photos stay ~50–150 KB, well under the server's 1.5 MB limit.
 */
export async function resizeImageFile(file, { maxSize = 640, quality = 0.86 } = {}) {
  if (!ACCEPTED.includes(file.type)) throw new Error('unsupported');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
