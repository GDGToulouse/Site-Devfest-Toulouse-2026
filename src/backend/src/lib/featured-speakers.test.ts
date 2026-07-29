import { describe, it, expect, beforeEach, vi } from "vitest";

import { FEATURED_SPEAKERS_COUNT, rotateFeaturedSpeakers } from "./featured-speakers.js";
import { prisma } from "./prisma.js";
import { revalidateSpeakers } from "./revalidate.js";
import { getFeaturedEdition } from "../routes/editions.js";

vi.mock("./prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn().mockResolvedValue([]),
    speakerEdition: { updateMany: vi.fn() },
  },
}));
vi.mock("./revalidate.js", () => ({ revalidateSpeakers: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../routes/editions.js", () => ({ getFeaturedEdition: vi.fn() }));

describe("rotateFeaturedSpeakers", () => {
  beforeEach(() => {
    vi.mocked(getFeaturedEdition).mockResolvedValue({ id: 1, year: 2026 } as never);
    vi.mocked(prisma.$queryRaw).mockReset();
    vi.mocked(prisma.$transaction).mockClear().mockResolvedValue([]);
    vi.mocked(revalidateSpeakers).mockClear();
  });

  it("features the speakers drawn at random and reports them", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 10, name: "Ada Lovelace" },
      { id: 11, name: "Alan Turing" },
    ] as never);

    const result = await rotateFeaturedSpeakers();

    expect(result).toEqual({ edition: 2026, featured: ["Ada Lovelace", "Alan Turing"] });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("purges the home cache, otherwise the new line-up would surface an hour late", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 10, name: "Ada" }] as never);

    await rotateFeaturedSpeakers();

    expect(revalidateSpeakers).toHaveBeenCalledOnce();
  });

  it("does nothing when there is no featured edition", async () => {
    vi.mocked(getFeaturedEdition).mockResolvedValue(null as never);

    const result = await rotateFeaturedSpeakers();

    expect(result).toEqual({ edition: null, featured: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(revalidateSpeakers).not.toHaveBeenCalled();
  });

  it("still clears the previous selection when no speaker can be drawn", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const result = await rotateFeaturedSpeakers();

    expect(result.featured).toEqual([]);
    // The transaction runs anyway: yesterday's featured speakers must not stay.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("targets the number of speakers the home page actually shows", () => {
    expect(FEATURED_SPEAKERS_COUNT).toBe(8);
  });
});
