import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit.js";

describe("RateLimiter", () => {
  it("allows up to max requests per window", () => {
    const now = 1_000_000;
    const limiter = new RateLimiter({
      windowMs: 1_000,
      max: 3,
      now: () => now,
    });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window passes", () => {
    let now = 1_000_000;
    const limiter = new RateLimiter({
      windowMs: 1_000,
      max: 1,
      now: () => now,
    });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
    now += 1_001;
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    const limiter = new RateLimiter({
      windowMs: 1_000,
      max: 1,
      now: () => now,
    });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(false);
  });

  it("prune drops stale keys", () => {
    let now = 1_000_000;
    const limiter = new RateLimiter({
      windowMs: 1_000,
      max: 5,
      now: () => now,
    });
    limiter.check("ephemeral");
    now += 5_000;
    limiter.prune();
    now += 0;
    expect(limiter.check("ephemeral").allowed).toBe(true);
  });
});
