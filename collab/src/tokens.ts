import { randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function mintToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function tokensEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function findTokenRole<R>(
  presented: string,
  entries: Iterable<[string, R]>,
): R | undefined {
  let match: R | undefined;
  for (const [token, role] of entries) {
    if (tokensEqual(presented, token)) {
      match = role;
    }
  }
  return match;
}
