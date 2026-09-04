/** Lowercase, kebab-case a name for use as a filename, e.g. "My Novel" → "my-novel". */
export function sanitizeFilename(name: string): string {
  const kebab = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return kebab || "export";
}
