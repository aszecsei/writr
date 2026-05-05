const IV_BYTES = 12;

export type RoomKey = CryptoKey;

export async function generateRoomKey(): Promise<RoomKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportRoomKey(key: RoomKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64url(new Uint8Array(raw));
}

export async function importRoomKey(encoded: string): Promise<RoomKey> {
  const raw = base64urlToBytes(encoded);
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayload(
  key: RoomKey,
  plaintext: Uint8Array,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return bytesToBase64url(out);
}

export async function decryptPayload(
  key: RoomKey,
  encoded: string,
): Promise<Uint8Array> {
  const bytes = base64urlToBytes(encoded);
  if (bytes.length <= IV_BYTES) {
    throw new Error("Ciphertext too short");
  }
  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(plaintext);
}

export interface ShareLinkParams {
  origin: string;
  roomUuid: string;
  token: string;
  keyEncoded: string;
}

export function buildShareUrl({
  origin,
  roomUuid,
  token,
  keyEncoded,
}: ShareLinkParams): string {
  return `${origin}/shared/${encodeURIComponent(roomUuid)}?t=${encodeURIComponent(token)}#k=${encodeURIComponent(keyEncoded)}`;
}

export function readShareKeyFromFragment(fragment: string): string | null {
  const trimmed = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);
  const k = params.get("k");
  return k && /^[A-Za-z0-9_-]+$/.test(k) ? k : null;
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i] as number);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(encoded: string): Uint8Array {
  const padLen = (4 - (encoded.length % 4)) % 4;
  const padded = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(encoded.length + padLen, "=");
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}
