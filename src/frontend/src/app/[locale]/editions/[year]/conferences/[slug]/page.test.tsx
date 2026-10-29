import { describe, it, expect, vi, beforeEach } from "vitest";

// #633 — the same talk had two pages cached apart, and one of them lost a
// speaker. A talk of the featured edition now has one page, /conferences; its
// dated address sends there, while a past year keeps its own page.

const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
const getCurrentEdition = vi.fn();
vi.mock("@/lib/api", () => ({
  getCurrentEdition: () => getCurrentEdition(),
  getEditionByYear: async () => null,
}));
vi.mock("@/lib/page-metadata", () => ({ pageMetadata: async () => ({}) }));
const getEditionTalkPage = vi.fn();
vi.mock("@/lib/preview", () => ({ getEditionTalkPage: (...args: unknown[]) => getEditionTalkPage(...args) }));

const { default: EditionTalkDetailPage, generateMetadata } = await import("./page");

function render(year: string, slug: string) {
  return EditionTalkDetailPage({ params: Promise.resolve({ locale: "fr", year, slug }) });
}

beforeEach(() => {
  redirect.mockClear();
  getEditionTalkPage.mockReset().mockResolvedValue(null);
  getCurrentEdition.mockReset().mockResolvedValue({ year: 2026 });
});

describe("Dated talk page (#633)", () => {
  it("should send a talk of the featured edition to its one page", async () => {
    const error = await render("2026", "l-impossible").catch((e: { url?: string }) => e);

    expect(error).toMatchObject({ url: "/fr/conferences/l-impossible" });
    expect(getEditionTalkPage).not.toHaveBeenCalled();
  });

  it("should keep serving the dated page of a past year", async () => {
    await render("2019", "un-talk").catch(() => null);

    expect(redirect).not.toHaveBeenCalled();
    expect(getEditionTalkPage).toHaveBeenCalledWith(2019, "un-talk");
  });
});

// #703 — the metadata asked the backend for /api/editions/NaN/talks/… before
// the page could refuse the year, and the 400 it got back became a 500.
describe("Dated talk page with a year that is not one (#703)", () => {
  it.each(["abc", "1.5", "0x7E9"])("should 404 on %j without calling the backend", async (year) => {
    const params = Promise.resolve({ locale: "fr", year, slug: "un-talk" });

    await expect(generateMetadata({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(year, "un-talk")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getEditionTalkPage).not.toHaveBeenCalled();
    expect(getCurrentEdition).not.toHaveBeenCalled();
  });
});
