import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getTags, getSpeakerBySlug, getIdentitySettings, BackendUnavailableError } from "./api";

// #345 — every failure used to collapse into `null`, so "this article does not
// exist" and "the backend is down" were indistinguishable. Pages turned the
// second into notFound(), and `s-maxage=3600` then served that 404 for an hour
// after recovery. These lock the three outcomes apart.

const originalFetch = global.fetch;

function mockFetch(impl: () => Promise<Response> | Response) {
  global.fetch = vi.fn(impl) as unknown as typeof fetch;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchAPI — a missing resource stays null", () => {
  it("should return null on a 404", async () => {
    mockFetch(() => new Response("", { status: 404 }));

    await expect(getSpeakerBySlug("nobody")).resolves.toBeNull();
  });

  // The list helpers turn that null into an empty array; a 404 there means
  // "nothing to show", not "something broke".
  it("should let list helpers fall back to an empty array on a 404", async () => {
    mockFetch(() => new Response("", { status: 404 }));

    await expect(getTags()).resolves.toEqual([]);
  });
});

describe("fetchAPI — an outage throws instead", () => {
  it("should throw when the backend answers 500", async () => {
    mockFetch(() => new Response("", { status: 500 }));

    await expect(getTags()).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("should throw when the backend answers 502", async () => {
    mockFetch(() => new Response("", { status: 502 }));

    await expect(getSpeakerBySlug("ada")).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("should throw when the network call fails outright", async () => {
    mockFetch(() => Promise.reject(new Error("ECONNREFUSED")));

    await expect(getTags()).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  // A 200 carrying HTML means something answered in the backend's place — a
  // proxy error page, a misrouted request. Treating it as "no data" is what
  // made the missing /api/replays rewrite look like an empty catalogue.
  it("should throw when a 200 does not carry JSON", async () => {
    mockFetch(() => new Response("<!doctype html><html></html>", { status: 200 }));

    await expect(getTags()).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("should carry the path and status for diagnosis", async () => {
    mockFetch(() => new Response("", { status: 503 }));

    await expect(getTags()).rejects.toMatchObject({ path: "/api/tags", status: 503 });
  });

  it("should log every failure server-side", async () => {
    mockFetch(() => new Response("", { status: 500 }));

    await expect(getTags()).rejects.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});

// `next build` prerenders manifest.ts and sitemap.ts with no backend running.
// Throwing there fails the whole build — which is exactly what broke CI when
// this change first landed.
describe("fetchAPI — build time degrades instead of throwing", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return null when the backend is unreachable during a build", async () => {
    mockFetch(() => Promise.reject(new Error("ECONNREFUSED")));

    await expect(getIdentitySettings()).resolves.toEqual({});
  });

  it("should return null on a 5xx during a build", async () => {
    mockFetch(() => new Response("", { status: 500 }));

    await expect(getTags()).resolves.toEqual([]);
  });

  it("should still log the failure", async () => {
    mockFetch(() => new Response("", { status: 500 }));

    await getTags();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("fetchAPI — success is unchanged", () => {
  it("should return the parsed payload", async () => {
    mockFetch(() => jsonResponse([{ id: 1, slug: "cloud", nameFr: "Cloud", nameEn: "Cloud" }]));

    await expect(getTags()).resolves.toHaveLength(1);
  });
});
