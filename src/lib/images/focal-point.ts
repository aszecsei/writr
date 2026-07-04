import smartcrop from "smartcrop";

/** A normalized focal point in `[0, 1]` for use with CSS `object-position`. */
export interface FocalPoint {
  x: number;
  y: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required so smartcrop can read pixels via canvas. Cross-origin hosts
    // without CORS headers still taint the canvas — caught by the caller.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Analyze an image and return the normalized center of its most salient region,
 * suitable for CSS `object-position`.
 *
 * Returns `null` when analysis is impossible — most commonly a cross-origin
 * image without CORS headers (which taints the canvas), but also load/decode
 * failures. Callers fall back to their default focal point in that case.
 */
export async function computeFocalPoint(
  url: string,
): Promise<FocalPoint | null> {
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;

    const { topCrop } = await smartcrop.crop(img, { width: 100, height: 100 });
    return {
      x: (topCrop.x + topCrop.width / 2) / width,
      y: (topCrop.y + topCrop.height / 2) / height,
    };
  } catch {
    // Canvas taint (cross-origin), load failure, or decode error — the caller
    // keeps its default focal point.
    return null;
  }
}
