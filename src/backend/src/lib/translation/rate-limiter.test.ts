import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
  it("allows requests under all limits", () => {
    const rl = new RateLimiter({ rpm: 5, rpd: 100, tpm: 10_000 });
    expect(rl.check(100)).toBeNull();
    rl.record(100);
    expect(rl.check(100)).toBeNull();
  });

  it("blocks when RPM is exceeded", () => {
    const rl = new RateLimiter({ rpm: 2, rpd: 100, tpm: 100_000 });
    rl.record(10);
    rl.record(10);
    const blocked = rl.check(10);
    expect(blocked).not.toBeNull();
    expect(blocked!.kind).toBe("rpm");
    expect(blocked!.retryAfterSec).toBeGreaterThan(0);
  });

  it("blocks when TPM would be exceeded", () => {
    const rl = new RateLimiter({ rpm: 100, rpd: 100, tpm: 1000 });
    rl.record(900);
    const blocked = rl.check(200);
    expect(blocked).not.toBeNull();
    expect(blocked!.kind).toBe("tpm");
  });

  it("blocks when RPD is exceeded", () => {
    const rl = new RateLimiter({ rpm: 1000, rpd: 2, tpm: 1_000_000 });
    rl.record(10);
    rl.record(10);
    const blocked = rl.check(10);
    expect(blocked).not.toBeNull();
    expect(blocked!.kind).toBe("rpd");
  });

  it("snapshot reports current usage", () => {
    const rl = new RateLimiter({ rpm: 10, rpd: 100, tpm: 50_000 });
    rl.record(500);
    rl.record(700);
    const snap = rl.snapshot();
    expect(snap.rpmUsed).toBe(2);
    expect(snap.tpmUsed).toBe(1200);
    expect(snap.rpdUsed).toBe(2);
  });
});
