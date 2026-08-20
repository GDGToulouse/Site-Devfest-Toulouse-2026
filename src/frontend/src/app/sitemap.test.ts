import { describe, it, expect, vi, beforeEach } from "vitest";

// #379 — talk pages, the largest body of unique content on the site, were
// absent from the sitemap entirely, and so were the sponsor pages. What matters
// here is not the count but that each URL is one the site actually serves:
// a past talk listed under /conferences/{slug} would be a 404 in the sitemap.

vi.mock("@/lib/api", () => ({
  getArticles: vi.fn(),
  getContentPage: vi.fn(),
  getCurrentEdition: vi.fn(),
  getEditions: vi.fn(),
  getEditionTalks: vi.fn(),
  getHallOfFame: vi.fn(),
  getIndexableSponsors: vi.fn(),
}));

import {
  getArticles,
  getContentPage,
  getCurrentEdition,
  getEditions,
  getEditionTalks,
  getHallOfFame,
  getIndexableSponsors,
} from "@/lib/api";
import sitemap, { dynamic } from "./sitemap";

const FEATURED = { id: 1, year: 2026 };

// sitemap.ts freezes BASE_URL at module load, so a hook could not change it.
// These assertions are about paths — which URLs the sitemap lists — so compare
// on the path and let the origin be whatever the environment supplies.
function paths(entries: { url: string }[]): string[] {
  return entries.map((e) => e.url.replace(/^.*?(?=\/(fr|en)(\/|$))/, ""));
}

beforeEach(() => {
  vi.mocked(getEditions).mockResolvedValue([
    { id: 1, year: 2026, status: "ANNOUNCEMENT", archivedSiteUrl: null, startDate: null, updatedAt: "2026-03-01T00:00:00Z" },
    { id: 2, year: 2025, status: "SEE_YOU_NEXT_YEAR", archivedSiteUrl: null, startDate: null, updatedAt: "2025-12-01T00:00:00Z" },
  ]);
  vi.mocked(getCurrentEdition).mockResolvedValue({ ...FEATURED, hasVenueInfo: true } as never);
  vi.mocked(getEditionTalks).mockImplementation(async (year: number) =>
    year === FEATURED.year
      ? ([{ slug: "talk-of-the-year", updatedAt: "2026-04-01T00:00:00Z" }] as never)
      : ([{ slug: "talk-of-the-past", updatedAt: "2025-04-01T00:00:00Z" }] as never),
  );
  vi.mocked(getIndexableSponsors).mockResolvedValue([
    { slug: "past-only-co", updatedAt: "2025-05-01T00:00:00Z" },
  ]);
  vi.mocked(getHallOfFame).mockResolvedValue([]);
  vi.mocked(getContentPage).mockResolvedValue(null);
  vi.mocked(getArticles).mockResolvedValue({ articles: [], total: 0, page: 1, totalPages: 0 });
});

describe("sitemap — talk pages (#379)", () => {
  it("lists the featured edition's talks under /conferences/{slug}", async () => {
    const entries = await sitemap();

    expect(paths(entries)).toContain("/fr/conferences/talk-of-the-year");
    expect(paths(entries)).toContain("/en/conferences/talk-of-the-year");
  });

  it("lists a past talk under its edition, never under /conferences", async () => {
    const entries = await sitemap();

    expect(paths(entries)).toContain("/fr/editions/2025/conferences/talk-of-the-past");
    // /conferences/{slug} resolves against the featured edition only, so this
    // URL would be a 404 — the exact mistake the two route families prevent.
    expect(paths(entries)).not.toContain("/fr/conferences/talk-of-the-past");
  });

  it("gives every entry its three alternates", async () => {
    const entries = await sitemap();
    const talk = entries.find((e) => e.url.endsWith("/fr/conferences/talk-of-the-year"));
    const languages = talk?.alternates?.languages ?? {};

    expect(Object.keys(languages).sort()).toEqual(["en", "fr", "x-default"]);
    expect(languages.fr).toBe(languages["x-default"]);
    expect(languages.en).toMatch(/\/en\/conferences\/talk-of-the-year$/);
  });
});

describe("sitemap — sponsor pages (#379)", () => {
  it("lists companies from the indexable set, not the featured wall", async () => {
    const entries = await sitemap();

    // past-only-co sponsors no current edition, so it is absent from the wall
    // while its page still answers 200.
    expect(paths(entries)).toContain("/fr/sponsors/past-only-co");
    expect(getIndexableSponsors).toHaveBeenCalled();
  });
});

describe("sitemap — routes that were missing (#379)", () => {
  it.each(["/editions", "/offres-emploi-partenaires"])("lists %s", async (route) => {
    const entries = await sitemap();

    expect(paths(entries)).toContain(`/fr${route}`);
  });

  // /lieu is not a static route: the page calls notFound() when the edition has
  // no venue info, so listing it unconditionally would put a 404 in the sitemap.
  it("lists /lieu only when the edition has venue info", async () => {
    vi.mocked(getCurrentEdition).mockResolvedValue({ ...FEATURED, hasVenueInfo: true } as never);
    expect(paths(await sitemap())).toContain("/fr/lieu");

    vi.mocked(getCurrentEdition).mockResolvedValue({ ...FEATURED, hasVenueInfo: false } as never);
    expect(paths(await sitemap())).not.toContain("/fr/lieu");
  });
});

describe("sitemap — lastmod tells the truth (#379)", () => {
  it("dates an entry from its entity, not from the crawl", async () => {
    const entries = await sitemap();
    const talk = entries.find((e) => e.url.endsWith("/fr/conferences/talk-of-the-year"));

    expect(talk?.lastModified).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("omits lastmod rather than inventing one", async () => {
    const entries = await sitemap();
    // A code-backed index page has no row, so it has no modification date.
    const home = entries.find((e) => paths([e])[0] === "/fr");

    expect(home?.lastModified).toBeUndefined();
  });
});

describe("sitemap — every article, not the first hundred (#379)", () => {
  it("follows pagination past the first page", async () => {
    vi.mocked(getArticles).mockImplementation(async (page = 1) => ({
      articles: [{ slug: `article-${page}`, titleEn: "", publishedAt: "2026-01-01T00:00:00Z" }] as never,
      total: 3,
      page,
      totalPages: 3,
    }));

    const entries = await sitemap();

    // The old code called getArticles(1, 100) once and stopped there.
    expect(paths(entries)).toContain("/fr/actualites/article-1");
    expect(paths(entries)).toContain("/fr/actualites/article-3");
  });
});

describe("sitemap — never served from the build (#426)", () => {
  it("opts out of prerendering", async () => {
    // `next build` has no backend: prerendering this route bakes in a sitemap
    // holding the static routes and nothing else, and that is what the first
    // crawler after a deployment receives. Observed on beta, 28 URLs against
    // the 1310 a fresh render produces.
    expect(dynamic).toBe("force-dynamic");
  });
});
