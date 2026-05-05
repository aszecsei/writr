import { describe, expect, it } from "vitest";
import {
  base64urlToBytes,
  buildShareUrl,
  bytesToBase64url,
  decryptPayload,
  encryptPayload,
  exportRoomKey,
  generateRoomKey,
  importRoomKey,
  readShareKeyFromFragment,
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

describe("share URL helpers", () => {
  it("builds a share URL with key in the fragment", () => {
    const url = buildShareUrl({
      origin: "https://writr.app",
      roomUuid: "11111111-2222-3333-4444-555555555555",
      token: "tok",
      keyEncoded: "abc-123_xyz",
    });
    expect(url).toBe(
      "https://writr.app/shared/11111111-2222-3333-4444-555555555555?t=tok#k=abc-123_xyz",
    );
  });

  it("extracts the key from a fragment string", () => {
    expect(readShareKeyFromFragment("#k=abc_def-123")).toBe("abc_def-123");
    expect(readShareKeyFromFragment("k=abc")).toBe("abc");
    expect(readShareKeyFromFragment("")).toBeNull();
    expect(readShareKeyFromFragment("#other=true")).toBeNull();
    expect(readShareKeyFromFragment("#k=has+invalid+chars")).toBeNull();
  });
});
