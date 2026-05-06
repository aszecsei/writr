/**
 * Display-name handling for collab sessions. Names live in `localStorage`
 * so a returning user doesn't have to re-enter; the host gets the same
 * key as guests so a single user that flips roles keeps one display name.
 */

const NAME_KEY = "writr.collab.displayName";

export const HOST_DEFAULT_NAME = "Host";
export const GUEST_DEFAULT_NAME = "Guest";

export const HOST_DEFAULT_COLOR = "#10b981";

/**
 * Stable palette for guest carets. Picked deterministically from the
 * display name so the same name keeps the same color across reconnects.
 */
const GUEST_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
] as const;

export function readStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage might be disabled — name persistence is best-effort.
  }
}

export function pickGuestColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return GUEST_COLOR_PALETTE[Math.abs(hash) % GUEST_COLOR_PALETTE.length];
}

export interface BuildIdentityOptions {
  role: "host" | "guest";
  name: string;
}

export function buildIdentity({ role, name }: BuildIdentityOptions): {
  name: string;
  color: string;
} {
  const trimmed = name.trim();
  const finalName =
    trimmed || (role === "host" ? HOST_DEFAULT_NAME : GUEST_DEFAULT_NAME);
  const color =
    role === "host" ? HOST_DEFAULT_COLOR : pickGuestColor(finalName);
  return { name: finalName, color };
}
