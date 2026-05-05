/**
 * Reads the public collab relay URL from the environment.
 *
 * The collab feature is OFF unless this env var is set. UI components must
 * call `isCollabEnabled()` and render nothing collab-related when it's
 * `false` — the non-collaborative experience must remain unchanged.
 *
 * The URL should be the WebSocket origin of the relay (e.g.
 * `wss://collab.writr.app` in production, `ws://localhost:4444` in dev).
 * The HTTP origin used for `POST /rooms` is derived from this by
 * `wsToHttpOrigin()`.
 */
export function getCollabBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^wss?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

export function isCollabEnabled(): boolean {
  return getCollabBaseUrl() !== null;
}

export function wsToHttpOrigin(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");
}
