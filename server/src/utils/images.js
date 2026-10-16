import { ApiError } from '../middleware/errorHandler.js';

/** Identify PNG/JPEG by file signature (never trust the declared MIME type). */
export function detectImage(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  return null;
}

/** Decode a `data:image/png|jpeg;base64,...` upload and verify it is a real PNG/JPEG within the size limit. */
export function decodeImageDataUrl(dataUrl, { maxBytes = 1.5 * 1024 * 1024 } = {}) {
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) throw ApiError.badRequest('Upload a PNG or JPEG image', { dataUrl: 'Must be a PNG or JPEG data URL' });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw ApiError.badRequest(`Image must be smaller than ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB`, { dataUrl: 'File too large' });
  }
  const type = detectImage(buffer);
  if (!type) throw ApiError.badRequest('The file is not a valid PNG or JPEG image', { dataUrl: 'Unrecognised image data' });
  return { buffer, ...type };
}
