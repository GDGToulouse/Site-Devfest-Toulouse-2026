// Simple in-memory rate limiter tracking three distinct quotas in parallel:
//   - RPM: requests per minute (sliding window of 60s)
//   - RPD: requests per day (calendar day in UTC; resets at midnight UTC by
//          rounding "now" to a YYYY-MM-DD bucket key — close enough to the
//          actual Pacific Time reset of the Gemini free tier that we won't
//          significantly over- or under-count for our usage volumes)
//   - TPM: tokens per minute (sliding window of 60s)
//
// Mono-instance only. If we ever scale to multiple backend pods, swap this
// for Redis. The interface is intentionally small to make that swap easy.
//
// Defaults match Gemini 2.5 Flash-Lite free tier:
//   15 RPM, 1000 RPD, 250000 TPM.
// Override via constructor for tests or for the higher-tier "high" model.

export interface QuotaSnapshot {
  rpmUsed: number;
  rpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  tpmUsed: number;
  tpmLimit: number;
  retryAfterSec: number;
}

export interface RateLimiterOptions {
  rpm?: number;
  rpd?: number;
  tpm?: number;
}

export class RateLimiter {
  private rpmEvents: number[] = [];          // timestamps (ms)
  private tpmEvents: { ts: number; tokens: number }[] = [];
  private rpdCount = 0;
  private rpdDayKey = "";

  readonly rpmLimit: number;
  readonly rpdLimit: number;
  readonly tpmLimit: number;

  constructor(opts: RateLimiterOptions = {}) {
    this.rpmLimit = opts.rpm ?? 15;
    this.rpdLimit = opts.rpd ?? 1000;
    this.tpmLimit = opts.tpm ?? 250_000;
  }

  private dayKey(now: number): string {
    return new Date(now).toISOString().slice(0, 10);
  }

  private prune(now: number): void {
    const cutoff = now - 60_000;
    this.rpmEvents = this.rpmEvents.filter((t) => t >= cutoff);
    this.tpmEvents = this.tpmEvents.filter((e) => e.ts >= cutoff);
    const today = this.dayKey(now);
    if (today !== this.rpdDayKey) {
      this.rpdDayKey = today;
      this.rpdCount = 0;
    }
  }

  /** Estimated retry-after in seconds when we are over a quota. */
  private retryHint(now: number, kind: "rpm" | "tpm" | "rpd"): number {
    if (kind === "rpd") {
      // Until next UTC midnight.
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
    }
    // For RPM/TPM the oldest event in the 60s window unblocks first.
    const oldest = kind === "rpm" ? this.rpmEvents[0] : this.tpmEvents[0]?.ts;
    if (!oldest) return 60;
    return Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
  }

  /**
   * Check whether a request consuming `estTokens` would fit in all quotas.
   * Returns null if allowed, or { kind, retryAfterSec } if blocked.
   */
  check(estTokens: number): { kind: "rpm" | "tpm" | "rpd"; retryAfterSec: number } | null {
    const now = Date.now();
    this.prune(now);

    if (this.rpdCount >= this.rpdLimit) return { kind: "rpd", retryAfterSec: this.retryHint(now, "rpd") };
    if (this.rpmEvents.length >= this.rpmLimit) return { kind: "rpm", retryAfterSec: this.retryHint(now, "rpm") };
    const tpmSum = this.tpmEvents.reduce((s, e) => s + e.tokens, 0);
    if (tpmSum + estTokens > this.tpmLimit) return { kind: "tpm", retryAfterSec: this.retryHint(now, "tpm") };

    return null;
  }

  /** Record an actual request (post-call). `tokens` = input + output. */
  record(tokens: number): void {
    const now = Date.now();
    this.prune(now);
    this.rpmEvents.push(now);
    this.tpmEvents.push({ ts: now, tokens });
    this.rpdCount += 1;
  }

  snapshot(): QuotaSnapshot {
    const now = Date.now();
    this.prune(now);
    const tpmSum = this.tpmEvents.reduce((s, e) => s + e.tokens, 0);
    return {
      rpmUsed: this.rpmEvents.length,
      rpmLimit: this.rpmLimit,
      rpdUsed: this.rpdCount,
      rpdLimit: this.rpdLimit,
      tpmUsed: tpmSum,
      tpmLimit: this.tpmLimit,
      retryAfterSec: 0,
    };
  }
}

// Singleton shared by all callers in this process. One limiter covers both
// Flash-Lite and Flash because they share the same project-level free quota
// (separate per-model limits exist but are higher than the per-project ones
// that hit first; safer to use the conservative Flash-Lite ceiling).
export const sharedRateLimiter = new RateLimiter();
