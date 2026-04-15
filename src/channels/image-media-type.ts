import type { ImageMediaType } from '../core/types.js';

/** Normalize an arbitrary MIME string to one of the image media types supported by the vision pipeline. */
export function normalizeMimeToMedia(mime: string | null | undefined): ImageMediaType {
  if (!mime) return 'image/jpeg';
  const lower = mime.toLowerCase();
  if (lower === 'image/png') return 'image/png';
  if (lower === 'image/webp') return 'image/webp';
  if (lower === 'image/gif') return 'image/gif';
  return 'image/jpeg';
}

/** Infer image media type from a file path/extension (Telegram's getFile returns only a path). */
export function inferMediaTypeFromPath(path: string): ImageMediaType {
  const p = path.toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
