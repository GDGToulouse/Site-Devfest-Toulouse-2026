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
vi.mock("@/lib/api", () => ({
  getCurrentEdition: async () => ({ year: 2026 }),
  getEditionByYear: async () => null,
}));
const getEditionTalkPage = vi.fn();
vi.mock("@/lib/preview", () => ({ getEditionTalkPage: (...args: unknown[]) => getEditionTalkPage(...args) }));

const { default: EditionTalkDetailPage } = await import("./page");

function render(year: string, slug: string) {
  return EditionTalkDetailPage({ params: Promise.resolve({ locale: "fr", year, slug }) });
}

beforeEach(() => {
  redirect.mockClear();
  getEditionTalkPage.mockReset().mockResolvedValue(null);
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
