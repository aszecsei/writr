import { describe, expect, it } from "vitest";
import {
  base64urlToBytes,
  buildShareUrl,
  bytesToBase64url,
  decryptPayload,
  deriveWrapKey,
  encryptPayload,
  exportRoomKey,
  exportX25519PrivJwk,
  generateRoomKey,
  generateX25519Keypair,
  importRoomKey,
  importX25519PrivJwk,
  importX25519PubFromEncoded,
  readHostPubFromFragment,
  unwrapRoomKey,
  wrapRoomKey,
} from "./crypto";

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const input = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const round = base64urlToBytes(bytesToBase64url(input));
    expect(Array.from(round)).toEqual(Array.from(input));
  });

  it("emits url-safe alphabet without padding", () => {
    const out = bytesToBase64url(new Uint8Array([255, 255, 255]));
    expect(out).not.toContain("+");
    expect(out).not.toContain("/");
    expect(out).not.toContain("=");
  });
});

describe("room key", () => {
  it("generates a key that can be exported and re-imported losslessly", async () => {
    const key = await generateRoomKey();
    const exported = await exportRoomKey(key);
    expect(exported).toMatch(/^[A-Za-z0-9_-]+$/);
    const reimported = await importRoomKey(exported);

    const plaintext = new TextEncoder().encode("hello world");
    const ct = await encryptPayload(reimported, plaintext);
    const decrypted = await decryptPayload(key, ct);
    expect(new TextDecoder().decode(decrypted)).toBe("hello world");
  });
});

describe("encryptPayload / decryptPayload", () => {
  it("round-trips a payload", async () => {
    const key = await generateRoomKey();
    const plaintext = new TextEncoder().encode("the quick brown fox");
    const encoded = await encryptPayload(key, plaintext);
    const decoded = await decryptPayload(key, encoded);
    expect(new TextDecoder().decode(decoded)).toBe("the quick brown fox");
  });

  it("uses a fresh IV per call (same plaintext yields different ciphertext)", async () => {
    const key = await generateRoomKey();
    const plaintext = new TextEncoder().encode("identical");
    const a = await encryptPayload(key, plaintext);
    const b = await encryptPayload(key, plaintext);
    expect(a).not.toBe(b);
  });

  it("rejects ciphertext that has been tampered with", async () => {
    const key = await generateRoomKey();
    const plaintext = new TextEncoder().encode("important");
    const encoded = await encryptPayload(key, plaintext);
    const bytes = base64urlToBytes(encoded);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 0xff;
    const tampered = bytesToBase64url(bytes);
    await expect(decryptPayload(key, tampered)).rejects.toThrow();
  });

  it("rejects decryption with a different key", async () => {
    const a = await generateRoomKey();
    const b = await generateRoomKey();
    const ct = await encryptPayload(a, new TextEncoder().encode("secret"));
    await expect(decryptPayload(b, ct)).rejects.toThrow();
  });

  it("rejects ciphertext that is too short to contain an IV", async () => {
    const key = await generateRoomKey();
    await expect(decryptPayload(key, "AA")).rejects.toThrow(/too short/i);
  });
});

describe("X25519 keypair", () => {
  it("generates a keypair and round-trips the private key via JWK", async () => {
    const pair = await generateX25519Keypair();
    expect(pair.pubEncoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const jwk = await exportX25519PrivJwk(pair.priv);
    const reimported = await importX25519PrivJwk(jwk);
    expect(reimported).toBeDefined();
  });

  it("imports a public key from the encoded form", async () => {
    const pair = await generateX25519Keypair();
    const reimported = await importX25519PubFromEncoded(pair.pubEncoded);
    expect(reimported).toBeDefined();
  });

  it("rejects malformed encoded public keys", async () => {
    await expect(importX25519PubFromEncoded("not!base64")).rejects.toThrow();
  });
});

describe("deriveWrapKey + wrapRoomKey/unwrapRoomKey", () => {
  it("host and guest derive the same wrap key", async () => {
    const host = await generateX25519Keypair();
    const guest = await generateX25519Keypair();
    const roomUuid = "11111111-2222-3333-4444-555555555555";
    const guestPubAsHostSees = await importX25519PubFromEncoded(
      guest.pubEncoded,
    );
    const hostPubAsGuestSees = await importX25519PubFromEncoded(
      host.pubEncoded,
    );

    const hostWrap = await deriveWrapKey(
      host.priv,
      guestPubAsHostSees,
      roomUuid,
    );
    const guestWrap = await deriveWrapKey(
      guest.priv,
      hostPubAsGuestSees,
      roomUuid,
    );

    const probe = new TextEncoder().encode("probe");
    const ct = await encryptPayload(hostWrap, probe);
    const pt = await decryptPayload(guestWrap, ct);
    expect(new TextDecoder().decode(pt)).toBe("probe");
  });

  it("derives a different wrap key when the roomUuid (HKDF salt) differs", async () => {
    const host = await generateX25519Keypair();
    const guest = await generateX25519Keypair();
    const guestPubAsHostSees = await importX25519PubFromEncoded(
      guest.pubEncoded,
    );
    const hostPubAsGuestSees = await importX25519PubFromEncoded(
      host.pubEncoded,
    );

    const a = await deriveWrapKey(host.priv, guestPubAsHostSees, "room-a");
    const b = await deriveWrapKey(guest.priv, hostPubAsGuestSees, "room-b");

    const ct = await encryptPayload(a, new TextEncoder().encode("hi"));
    await expect(decryptPayload(b, ct)).rejects.toThrow();
  });

  it("wraps and unwraps a room key", async () => {
    const host = await generateX25519Keypair();
    const guest = await generateX25519Keypair();
    const roomUuid = "abcd";
    const guestPubAsHostSees = await importX25519PubFromEncoded(
      guest.pubEncoded,
    );
    const hostPubAsGuestSees = await importX25519PubFromEncoded(
      host.pubEncoded,
    );
    const hostWrap = await deriveWrapKey(
      host.priv,
      guestPubAsHostSees,
      roomUuid,
    );
    const guestWrap = await deriveWrapKey(
      guest.priv,
      hostPubAsGuestSees,
      roomUuid,
    );

    const roomKey = await generateRoomKey();
    const wrapped = await wrapRoomKey(hostWrap, roomKey);
    const unwrapped = await unwrapRoomKey(guestWrap, wrapped);

    const probe = new TextEncoder().encode("payload");
    const ct = await encryptPayload(roomKey, probe);
    const pt = await decryptPayload(unwrapped, ct);
    expect(new TextDecoder().decode(pt)).toBe("payload");
  });

  it("rejects truncated wrapped ciphertext", async () => {
    const host = await generateX25519Keypair();
    const guest = await generateX25519Keypair();
    const guestPubAsHostSees = await importX25519PubFromEncoded(
      guest.pubEncoded,
    );
    const hostPubAsGuestSees = await importX25519PubFromEncoded(
      host.pubEncoded,
    );
    const hostWrap = await deriveWrapKey(host.priv, guestPubAsHostSees, "r");
    const guestWrap = await deriveWrapKey(guest.priv, hostPubAsGuestSees, "r");

    await expect(unwrapRoomKey(guestWrap, "AA")).rejects.toThrow();
    const roomKey = await generateRoomKey();
    const wrapped = await wrapRoomKey(hostWrap, roomKey);
    const truncated = wrapped.slice(0, wrapped.length - 4);
    await expect(unwrapRoomKey(guestWrap, truncated)).rejects.toThrow();
  });
});

describe("share URL helpers", () => {
  it("builds a share URL with host pubkey in the fragment", () => {
    const url = buildShareUrl({
      origin: "https://writr.app",
      roomUuid: "11111111-2222-3333-4444-555555555555",
      token: "tok",
      hostPubEncoded: "abc-123_xyz",
    });
    expect(url).toBe(
      "https://writr.app/shared/11111111-2222-3333-4444-555555555555?t=tok#h=abc-123_xyz",
    );
  });

  it("extracts the host pubkey from a fragment string", () => {
    expect(readHostPubFromFragment("#h=abc_def-123")).toBe("abc_def-123");
    expect(readHostPubFromFragment("h=abc")).toBe("abc");
    expect(readHostPubFromFragment("")).toBeNull();
    expect(readHostPubFromFragment("#other=true")).toBeNull();
    expect(readHostPubFromFragment("#h=has+invalid+chars")).toBeNull();
    expect(readHostPubFromFragment("#k=abc_def-123")).toBeNull();
  });

  it("encodes project mode in the URL fragment", () => {
    const url = buildShareUrl({
      origin: "https://writr.app",
      roomUuid: "11111111-2222-3333-4444-555555555555",
      token: "tok",
      hostPubEncoded: "abc-123_xyz",
      mode: "project",
    });
    expect(url).toBe(
      "https://writr.app/shared/11111111-2222-3333-4444-555555555555?t=tok#h=abc-123_xyz&p=1",
    );
  });

  it("omits the project flag when mode is chapter or unset", () => {
    const chapterUrl = buildShareUrl({
      origin: "https://x.app",
      roomUuid: "r",
      token: "t",
      hostPubEncoded: "h",
      mode: "chapter",
    });
    const defaultUrl = buildShareUrl({
      origin: "https://x.app",
      roomUuid: "r",
      token: "t",
      hostPubEncoded: "h",
    });
    expect(chapterUrl).toBe(defaultUrl);
    expect(chapterUrl.includes("p=1")).toBe(false);
  });

  it("readModeFromFragment defaults to chapter when no flag is present", async () => {
    const { readModeFromFragment } = await import("./crypto");
    expect(readModeFromFragment("")).toBe("chapter");
    expect(readModeFromFragment("#h=abc")).toBe("chapter");
    expect(readModeFromFragment("h=abc")).toBe("chapter");
  });

  it("readModeFromFragment returns project when p=1 is present", async () => {
    const { readModeFromFragment } = await import("./crypto");
    expect(readModeFromFragment("#h=abc&p=1")).toBe("project");
    expect(readModeFromFragment("h=abc&p=1")).toBe("project");
  });

  it("readModeFromFragment ignores other p= values", async () => {
    const { readModeFromFragment } = await import("./crypto");
    expect(readModeFromFragment("#p=2")).toBe("chapter");
    expect(readModeFromFragment("#p=true")).toBe("chapter");
  });
});
