import { describe, it, expect, vi, beforeEach } from "vitest";

// #618 — outside draft mode the pages read the public record, untouched; in
// draft mode they read the preview, and a draft cookie that outlived its
// session falls back to the public page instead of failing.

let isEnabled = false;
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled }),
  cookies: async () => ({ toString: () => "" }),
}));

const getSpeakerBySlug = vi.fn();
vi.mock("./api", async (importActual) => ({
  ...(await importActual<typeof import("./api")>()),
  getSpeakerBySlug: (...args: unknown[]) => getSpeakerBySlug(...args),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { getSpeakerPage } = await import("./preview");

beforeEach(() => {
  getSpeakerBySlug.mockReset().mockResolvedValue({ name: "Publié" });
  fetchMock.mockReset();
});

describe("getSpeakerPage (#618)", () => {
  it("should read the public record outside draft mode, never the preview", async () => {
    isEnabled = false;

    const speaker = await getSpeakerPage("ada");

    expect(speaker).toEqual({ name: "Publié" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should read the draft in draft mode", async () => {
    isEnabled = true;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "Brouillon" }), { status: 200 }));

    const speaker = await getSpeakerPage("ada");

    expect(speaker).toEqual({ name: "Brouillon" });
    expect(getSpeakerBySlug).not.toHaveBeenCalled();
  });

  it("should fall back to the public record when the session behind the draft cookie is gone", async () => {
    isEnabled = true;
    fetchMock.mockResolvedValue(new Response("", { status: 403 }));

    const speaker = await getSpeakerPage("ada");

    expect(speaker).toEqual({ name: "Publié" });
  });
});
