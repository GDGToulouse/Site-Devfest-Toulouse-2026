import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module reads REVALIDATE_SECRET and FRONTEND_URL at import time, so both
// have to be set before it is loaded.
process.env.REVALIDATE_SECRET = "test-secret-not-a-real-credential";
process.env.FRONTEND_URL = "http://frontend.test:3000";

const { revalidateAll } = await import("./revalidate.js");

describe("revalidateAll (#358)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("asks the frontend for a global purge, not a list of paths", async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await revalidateAll();

    expect(result.ok).toBe(true);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("http://frontend.test:3000/api/revalidate");
    const body = JSON.parse((init as RequestInit).body as string);
    // `all` is what makes this different from every other helper: the import
    // touches so many pages that enumerating them would be incomplete.
    expect(body.all).toBe(true);
    expect(body.secret).toBe("test-secret-not-a-real-credential");
    expect(body.paths).toBeUndefined();
  });

  it("reports a refusal instead of throwing", async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response("nope", { status: 403 }));

    const result = await revalidateAll();

    // The caller is a CLI script whose database work already succeeded: it must
    // be able to warn without failing the run.
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("403");
  });

  it("reports an unreachable frontend instead of throwing", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await revalidateAll();

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ECONNREFUSED");
  });
});
