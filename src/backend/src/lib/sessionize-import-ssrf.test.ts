import { describe, it, expect, vi } from "vitest";

import { loadSessionizeData } from "./sessionize-import.js";

// The Sessionize import URL comes from a back-office form. Before #306 it was
// fetched with no SSRF guard, so an editor could aim it at the cloud metadata
// endpoint or an internal service on the shared network. These check the guard
// runs *before* any fetch — a rejected URL must never reach the network.

describe("loadSessionizeData SSRF guard (#306)", () => {
  it("rejects a loopback URL before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(loadSessionizeData({ url: "http://127.0.0.1/all" })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects the cloud metadata address before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      loadSessionizeData({ url: "http://169.254.169.254/latest/meta-data/" }),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects an internal container hostname (private range) before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // 10.x is one of the private ranges validateWebhookUrl blocks.
    await expect(loadSessionizeData({ url: "http://10.0.0.5:5432/" })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a non-http scheme", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(loadSessionizeData({ url: "file:///etc/passwd" })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("still accepts inline JSON without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // Minimal valid-ish payload: the guard is URL-only, JSON goes straight through.
    const data = await loadSessionizeData({ json: JSON.stringify({ sessions: [], speakers: [] }) });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(data).toBeDefined();
    fetchSpy.mockRestore();
  });
});
