import { describe, it, expect, vi, beforeEach } from "vitest";

// #703 — /fr/editions/abc asked the backend for /api/editions/NaN, got a 400
// and answered 500: an error page, and a 5xx alert for every address a crawler
// makes up. A segment that is not a year is a 404, decided without the backend.

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next/og", () => ({ ImageResponse: class {} }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("@/lib/page-metadata", () => ({ pageMetadata: async () => ({}) }));

const backend = vi.fn();
vi.mock("@/lib/api", () => {
  const call = (name: string) => async (...args: unknown[]) => backend(name, ...args);
  return {
    getCurrentEdition: call("getCurrentEdition"),
    getEditionByYear: call("getEditionByYear"),
    getEditions: call("getEditions"),
    getEditionSpeakers: call("getEditionSpeakers"),
    getEditionSponsors: call("getEditionSponsors"),
    getEditionTalks: call("getEditionTalks"),
  };
});

const { default: BilanPage, generateMetadata } = await import("./page");
const { default: OpengraphImage } = await import("./opengraph-image");

const params = (year: string) => ({ params: Promise.resolve({ locale: "fr", year }) });

beforeEach(() => {
  backend.mockReset().mockResolvedValue(null);
});

describe("Edition page with a year that is not one (#703)", () => {
  it.each(["abc", "NaN", "1.5", "0x7E9", "Infinity"])("should 404 on %j without calling the backend", async (year) => {
    await expect(BilanPage(params(year))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(params(year))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(OpengraphImage(params(year))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(backend).not.toHaveBeenCalled();
  });

  it("should still ask the backend for a well-formed year", async () => {
    await BilanPage(params("2019")).catch(() => null);

    expect(backend).toHaveBeenCalledWith("getEditionByYear", 2019);
  });
});
