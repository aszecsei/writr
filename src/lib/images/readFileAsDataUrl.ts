/**
 * Read a picked image file into a base64 `data:` URL.
 *
 * Rejects on read failure rather than resolving with a partial value, so
 * callers surface the error instead of silently storing nothing.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(
          new Error(
            `Expected a data URL string from FileReader, got ${typeof result} for "${file.name}"`,
          ),
        );
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(
        new Error(
          `Failed to read "${file.name}": ${reader.error?.message ?? "unknown error"}`,
        ),
      );
    reader.readAsDataURL(file);
  });
}

/** Approximate decoded byte size of a base64 `data:` URL. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
