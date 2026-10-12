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

  it("should fetch an absolute URL as it is", async () => {
    const fetchMock = stubFetch(new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } }));

    await imageDataUri("https://cdn.example/photo.jpg");

    expect(fetchMock.mock.calls[0][0]).toBe("https://cdn.example/photo.jpg");
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
