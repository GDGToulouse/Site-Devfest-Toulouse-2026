import { describe, it, expect, vi, beforeEach } from "vitest";

// #421 — a page created from the admin used to 404: no route could serve an
// arbitrary slug. What matters here is that an existing slug renders and a
// missing one still reaches the site's 404 rather than an empty shell.

vi.mock("@/lib/api", () => ({ getContentPage: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => locale),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/components/Breadcrumb", () => ({ default: () => null }));

import { getContentPage } from "@/lib/api";
import { notFound } from "next/navigation";
import ContentPageBySlug, { generateMetadata } from "./page";

let locale = "fr";

const PAGE = {
  id: 3,
  slug: "mentions-legales-applinkedin",
  titleFr: "Politique de confidentialité App LinkedIn",
  titleEn: "LinkedIn App Privacy Policy",
  contentFr: "<p>Contenu français</p>",
  contentEn: "<p>English content</p>",
  updatedAt: "2026-08-17T00:00:00Z",
};

const params = (slug: string) => Promise.resolve({ slug });

beforeEach(() => {
  locale = "fr";
  vi.mocked(getContentPage).mockReset();
});

describe("dynamic content page", () => {
  it("renders the page matching the slug", async () => {
    vi.mocked(getContentPage).mockResolvedValue(PAGE);

    const element = await ContentPageBySlug({ params: params(PAGE.slug) });

    expect(getContentPage).toHaveBeenCalledWith(PAGE.slug);
    expect(JSON.stringify(element)).toContain("Politique de confidentialité App LinkedIn");
  });

  it("serves the English columns under the en locale", async () => {
    locale = "en";
    vi.mocked(getContentPage).mockResolvedValue(PAGE);

    const element = await ContentPageBySlug({ params: params(PAGE.slug) });

    expect(JSON.stringify(element)).toContain("English content");
  });

  it("calls notFound when no page carries the slug", async () => {
    vi.mocked(getContentPage).mockResolvedValue(null);

    await expect(ContentPageBySlug({ params: params("slug-bidon") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("builds metadata with fr/en alternates on the same slug", async () => {
    vi.mocked(getContentPage).mockResolvedValue(PAGE);

    const meta = await generateMetadata({ params: params(PAGE.slug) });

    expect(meta.title).toBe(PAGE.titleFr);
    expect(meta.alternates?.languages).toMatchObject({
      fr: `/fr/${PAGE.slug}`,
      en: `/en/${PAGE.slug}`,
    });
  });

  // A missing page must not surface "undefined" as a title in <head>.
  it("returns empty metadata for an unknown slug", async () => {
    vi.mocked(getContentPage).mockResolvedValue(null);

    await expect(generateMetadata({ params: params("slug-bidon") })).resolves.toEqual({});
  });
});
