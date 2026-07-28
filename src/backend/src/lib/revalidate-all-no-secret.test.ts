import { describe, it, expect, vi, afterEach } from "vitest";

// REVALIDATE_SECRET is read once, when the module loads, so the "not configured"
// case cannot share a file with the configured one.
delete process.env.REVALIDATE_SECRET;

const { revalidateAll } = await import("./revalidate.js");

describe("revalidateAll without a secret (#358)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fails closed: no request is sent, and the caller is told why", async () => {
    global.fetch = vi.fn();

    const result = await revalidateAll();

    // Fail closed, like the rest of the module: with no secret configured we
    // never call out. The import still has to succeed — hence a reason to
    // report rather than a throw.
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("REVALIDATE_SECRET");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
