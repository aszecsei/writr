export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
    this.now = opts.now ?? Date.now;
  }

  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const t = this.now();
    const cutoff = t - this.windowMs;
    const existing = this.hits.get(key) ?? [];
    const fresh = existing.filter((ts) => ts > cutoff);
    if (fresh.length >= this.max) {
      this.hits.set(key, fresh);
      const oldest = fresh[0] ?? t;
      return { allowed: false, retryAfterMs: oldest + this.windowMs - t };
    }
    fresh.push(t);
    this.hits.set(key, fresh);
    return { allowed: true, retryAfterMs: 0 };
  }

  prune(): void {
    const cutoff = this.now() - this.windowMs;
    for (const [key, times] of this.hits) {
      const fresh = times.filter((ts) => ts > cutoff);
      if (fresh.length === 0) this.hits.delete(key);
      else this.hits.set(key, fresh);
    }
  }
}
