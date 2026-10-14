import { describe, it, expect, vi, beforeEach } from "vitest";

// #116 — the social cards of talks and sponsors. A talk slug is unique per
// edition only, so the card reads the edition the admin link names.
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor() {
      return new Response("png", { headers: { "content-type": "image/png" } });
    }
  },
}));

const getTalkBySlug = vi.fn();
const getEditionTalkBySlug = vi.fn();
const getSponsorBySlug = vi.fn();
vi.mock("@/lib/api", () => ({
  getTalkBySlug: (...args: unknown[]) => getTalkBySlug(...args),
  getEditionTalkBySlug: (...args: unknown[]) => getEditionTalkBySlug(...args),
  getSponsorBySlug: (...args: unknown[]) => getSponsorBySlug(...args),
}));

const talkCard = await import("./route");
const sponsorCard = await import("../../../sponsors/[slug]/social-card/route");

const TALK = { slug: "a11y", title: "Accessibilité", year: 2025, startsAt: null, room: null, category: null, speakers: [] };
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  getTalkBySlug.mockReset();
  getEditionTalkBySlug.mockReset();
  getSponsorBySlug.mockReset();
});

describe("Talk social card (#116)", () => {
  it("reads the talk of the edition named in ?year=", async () => {
    getEditionTalkBySlug.mockResolvedValue(TALK);

    const res = await talkCard.GET(new Request("http://x/conferences/a11y/social-card?year=2025"), params("a11y"));

    expect(getEditionTalkBySlug).toHaveBeenCalledWith(2025, "a11y");
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("falls back to the featured edition without a year, and answers 404 for an unknown talk", async () => {
    getTalkBySlug.mockResolvedValue(null);

    const res = await talkCard.GET(new Request("http://x/conferences/nope/social-card"), params("nope"));

    expect(getTalkBySlug).toHaveBeenCalledWith("nope");
    expect(res.status).toBe(404);
  });
});

describe("Sponsor social card (#116)", () => {
  it("answers 404 for an unknown sponsor", async () => {
    getSponsorBySlug.mockResolvedValue(null);

    const res = await sponsorCard.GET(new Request("http://x/sponsors/nope/social-card"), params("nope"));

    expect(res.status).toBe(404);
  });
});
