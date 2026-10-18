import { afterEach, describe, it, expect, vi } from "vitest";

import { imageDataUri } from "./og-image";

// #600 — a speaker photo is stored as /uploads/…, which Satori refuses.

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("imageDataUri (#600)", () => {
  it("should read an uploaded photo from the backend and hand it over as a data URI", async () => {
    const fetchMock = stubFetch(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }));

    const uri = await imageDataUri("/uploads/photo.png");

    expect(fetchMock.mock.calls[0][0]).toMatch(/^https?:\/\/[^/]+\/uploads\/photo\.png$/);
    expect(uri).toBe("data:image/png;base64,AQID");
  });

  // The URL comes from data a speaker or a sponsor typed, and these cards are
  // public: fetching it would let anyone make the server call any address.
  it("should not fetch an absolute URL, so the card draws its fallback", async () => {
    const fetchMock = stubFetch(new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } }));

    const uri = await imageDataUri("http://127.0.0.1:4000/api/health");

    expect(uri).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should give up on an upload whose declared size is over the ceiling, before reading it", async () => {
    const response = new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/png", "content-length": String(64 * 1024 * 1024) },
    });
    const read = vi.spyOn(response, "arrayBuffer");
    stubFetch(response);

    expect(await imageDataUri("/uploads/huge.png")).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("should give up on a missing image so the card draws its fallback", async () => {
    stubFetch(new Response("Not found", { status: 404 }));

    expect(await imageDataUri("/uploads/gone.png")).toBeNull();
  });

  it("should give up when the image cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    expect(await imageDataUri("/uploads/photo.png")).toBeNull();
  });
});

// #116 — a sponsor's logo can be one of the site's own static files, which the
// backend does not serve.
describe("imageDataUri — static files (#116)", () => {
  it("should read a file of public/ from disk rather than from the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const uri = await imageDataUri("/images/sponsors/aeronova-systems.svg");

    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should refuse a path that climbs out of public/", async () => {
    expect(await imageDataUri("/../package.json")).toBeNull();
    expect(await imageDataUri("/images/../../next.config.ts")).toBeNull();
  });
});
