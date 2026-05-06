const IV_BYTES = 12;
const HKDF_INFO = "writr.collab.roomKeyWrap.v1";

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
  key: CryptoKey,
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
  key: CryptoKey,
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

export interface X25519Keypair {
  priv: CryptoKey;
  pub: CryptoKey;
  pubEncoded: string;
}

export async function generateX25519Keypair(): Promise<X25519Keypair> {
  const pair = (await crypto.subtle.generateKey({ name: "X25519" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPub = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    priv: pair.privateKey,
    pub: pair.publicKey,
    pubEncoded: bytesToBase64url(new Uint8Array(rawPub)),
  };
}

export async function exportX25519PrivJwk(
  priv: CryptoKey,
): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", priv);
}

export async function importX25519PrivJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "X25519" }, true, [
    "deriveBits",
  ]);
}

export async function importX25519PubFromEncoded(
  encoded: string,
): Promise<CryptoKey> {
  const raw = base64urlToBytes(encoded);
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "X25519" },
    true,
    [],
  );
}

export async function deriveWrapKey(
  localPriv: CryptoKey,
  peerPub: CryptoKey,
  roomUuid: string,
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "X25519", public: peerPub },
    localPriv,
    256,
  );
  const hkdfBase = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"],
  );
  const salt = new TextEncoder().encode(roomUuid);
  const info = new TextEncoder().encode(HKDF_INFO);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: info as BufferSource,
    },
    hkdfBase,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapRoomKey(
  wrapKey: CryptoKey,
  roomKey: RoomKey,
): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", roomKey);
  return encryptPayload(wrapKey, new Uint8Array(raw));
}

export async function unwrapRoomKey(
  wrapKey: CryptoKey,
  encoded: string,
): Promise<RoomKey> {
  const raw = await decryptPayload(wrapKey, encoded);
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

export type ShareMode = "chapter" | "project";

export interface ShareLinkParams {
  origin: string;
  roomUuid: string;
  token: string;
  hostPubEncoded: string;
  /** Defaults to "chapter" for backward compatibility. When "project",
   *  the URL fragment carries `&p=1` so the guest router can mount the
   *  project shell instead of the active-chapter editor. The flag rides
   *  in the fragment so the relay never sees it. */
  mode?: ShareMode;
}

export function buildShareUrl({
  origin,
  roomUuid,
  token,
  hostPubEncoded,
  mode,
}: ShareLinkParams): string {
  const projectFlag = mode === "project" ? "&p=1" : "";
  return `${origin}/shared/${encodeURIComponent(roomUuid)}?t=${encodeURIComponent(token)}#h=${encodeURIComponent(hostPubEncoded)}${projectFlag}`;
}

export function readHostPubFromFragment(fragment: string): string | null {
  const trimmed = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);
  const h = params.get("h");
  return h && /^[A-Za-z0-9_-]+$/.test(h) ? h : null;
}

export function readModeFromFragment(fragment: string): ShareMode {
  const trimmed = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!trimmed) return "chapter";
  const params = new URLSearchParams(trimmed);
  return params.get("p") === "1" ? "project" : "chapter";
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
