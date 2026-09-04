import { z } from "zod/v4";

// ─── Shared Primitives ───────────────────────────────────────────────

export const timestamp = z.iso.datetime();

const DATA_IMAGE_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

/** Accepts "" (no image), an http(s) URL, or a base64 `data:image/*` URL. */
export function isSupportedImageSource(value: string): boolean {
  return (
    value === "" ||
    /^https?:\/\//.test(value) ||
    DATA_IMAGE_URL_PATTERN.test(value)
  );
}

export const ImageSourceSchema = z.string().refine(isSupportedImageSource, {
  message: "Must be an http(s) URL or a data:image/*;base64 URL",
});
