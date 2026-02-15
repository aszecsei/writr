interface ParsedImageDataUrl {
  mimeType: string;
  data: string;
}

/**
 * Parses a base64-encoded image data URL.
 * Returns null for non-data URLs or unsupported formats.
 */
export function parseBase64ImageDataUrl(
  url: string,
): ParsedImageDataUrl | null {
  const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
