import { describe, it, expect, vi, beforeEach } from "vitest";

// #703 — ?year=abc went to the backend as is, which refuses it with a 400, and
// fetchAPI turned that into a 500 page. A year filter that is not one is
// dropped: the page shows every replay, as for an unknown year.

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/page-metadata", () => ({ pageMetadata: async () => ({}) }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("@/components/replays/ReplayFiltersBar", () => ({ default: () => null }));

const getReplays = vi.fn();
vi.mock("@/lib/api", () => ({
  getReplays: (...args: unknown[]) => getReplays(...args),
  getReplayFilters: async () => ({ years: [], formats: [], categories: [] }),
  getCurrentEdition: async () => null,
}));

const { default: ReplaysPage } = await import("./page");

function render(query: Record<string, string>) {
  return ReplaysPage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve(query) });
}

beforeEach(() => {
  getReplays.mockReset().mockResolvedValue([]);
});

describe("Replays year filter (#703)", () => {
  it.each(["abc", "1.5", "0x7E9"])("should drop %j instead of sending it to the backend", async (year) => {
    await render({ year });

    expect(getReplays).toHaveBeenCalledWith(expect.objectContaining({ year: "" }));
  });

  it("should keep a well-formed year", async () => {
    await render({ year: "2019" });

    expect(getReplays).toHaveBeenCalledWith(expect.objectContaining({ year: "2019" }));
  });
});
