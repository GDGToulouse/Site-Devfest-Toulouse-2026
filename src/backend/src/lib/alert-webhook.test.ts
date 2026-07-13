import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { buildAlertPayload, isThrottled, resetThrottle, sendAlert } from "./alert-webhook.js";

vi.mock("./prisma.js", () => ({
  prisma: { siteSetting: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("./webhook-url.js", () => ({ validateWebhookUrl: vi.fn().mockResolvedValue(undefined) }));

describe("buildAlertPayload", () => {
  it("carries the route pattern and the error message, never the raw URL", () => {
    const payload = buildAlertPayload({
      method: "GET",
      route: "/api/talks/:slug",
      statusCode: 500,
      error: new Error("boom"),
    });

    expect(payload).toMatchObject({
      kind: "server_error",
      method: "GET",
      route: "/api/talks/:slug",
      statusCode: 500,
      error: "boom",
    });
    expect(payload.occurredAt).toBeTruthy();
  });

  it("truncates very long error messages", () => {
    const payload = buildAlertPayload({
      method: "POST",
      route: "/api/x",
      statusCode: 500,
      error: new Error("e".repeat(900)),
    });

    expect(payload.error.length).toBeLessThanOrEqual(501); // 500 + ellipsis
    expect(payload.error.endsWith("…")).toBe(true);
  });
});

describe("isThrottled", () => {
  beforeEach(() => resetThrottle());

  it("lets the first occurrence through, then holds identical ones", () => {
    const now = 1_000_000;
    expect(isThrottled("sig", now)).toBe(false);
    expect(isThrottled("sig", now + 1_000)).toBe(true);
  });

  it("lets a different signature through immediately", () => {
    const now = 1_000_000;
    isThrottled("sig-a", now);
    expect(isThrottled("sig-b", now)).toBe(false);
  });

  it("re-arms once the window has elapsed", () => {
    const now = 1_000_000;
    isThrottled("sig", now);
    expect(isThrottled("sig", now + 5 * 60 * 1000 + 1)).toBe(false);
  });
});

describe("sendAlert", () => {
  beforeEach(() => {
    resetThrottle();
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  const payload = () =>
    buildAlertPayload({ method: "GET", route: "/api/x", statusCode: 500, error: new Error("boom") });

  it("skips when no webhook URL is configured", async () => {
    const result = await sendAlert(payload());
    expect(result.status).toBe("skipped");
  });

  it("posts the payload when a URL is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAlert(payload(), { urlOverride: "https://hooks.example.com/x" });

    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/x");
    expect(JSON.parse(init.body).kind).toBe("server_error");
  });

  it("reports a non-2xx response as failed without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const result = await sendAlert(payload(), { urlOverride: "https://hooks.example.com/x" });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("500");
  });

  it("reports a network failure as failed without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await sendAlert(payload(), { urlOverride: "https://hooks.example.com/x" });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("network down");
  });

  it("does not throttle an explicit test (urlOverride)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    const first = await sendAlert(payload(), { urlOverride: "https://hooks.example.com/x" });
    const second = await sendAlert(payload(), { urlOverride: "https://hooks.example.com/x" });

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
  });
});
