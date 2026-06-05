import { afterEach, describe, expect, it, vi } from "vitest";
import { isNestingEnabled } from "./config";

describe("isNestingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when the env var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NESTING", "");
    expect(isNestingEnabled()).toBe(false);
  });

  it("is off for unrecognized values", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NESTING", "no");
    expect(isNestingEnabled()).toBe(false);
  });

  it("is on for 'true' or '1'", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NESTING", "true");
    expect(isNestingEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NESTING", "1");
    expect(isNestingEnabled()).toBe(true);
  });
});
