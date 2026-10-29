import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Writes carry their own requireAdminRole (#521): the caller is stubbed as an ADMIN.
vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => ({
    user: { id: "test-admin", email: "admin@test.local", name: "Test", role: "ADMIN" },
  }),
}));

// Paths are asserted, not sent: the real builders stay, only the call is stubbed.
vi.mock("../lib/revalidate.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/revalidate.js")>()),
  revalidatePaths: vi.fn(),
}));

const { buildAdminApp } = await import("./test-admin-app.js");
const { prisma } = await import("../lib/prisma.js");
const { revalidatePaths } = await import("../lib/revalidate.js");
const { getFeaturedEdition } = await import("../routes/editions.js");

// #693 — since #375 a participation freezes its tier's name, colour and logo
// scale. Editing the tier only touched the catalogue, so the featured edition
// kept the old label on the sponsors who had it before the rename, and showed
// the new one on those added after. The edit now follows on the editions that
// are not over yet, and never on the archive.
const PAST_YEAR = 1693;
const stamp = `${Date.now()}-${Math.round(performance.now())}`;

let tierId: number;
let currentYear: number;
let pastEditionId: number | undefined;
const sponsorIds: number[] = [];

async function sponsorOn(editionId: number, label: string, frozen: boolean) {
  const sponsor = await prisma.sponsor.create({
    data: {
      name: `Tier rename ${label}`,
      slug: `tier-rename-${label}-${stamp}`,
      editions: {
        create: [{
          editionId,
          tierId,
          publicationStatus: "PUBLISHED",
          ...(frozen && { tierNameFr: "Médias", tierNameEn: "Media", tierColor: "#111111", tierLogoScale: 0.8 }),
        }],
      },
    },
  });
  sponsorIds.push(sponsor.id);
  return sponsor;
}

async function participationOf(sponsorId: number) {
  return prisma.editionSponsor.findFirstOrThrow({
    where: { sponsorId },
    select: { tierNameFr: true, tierNameEn: true, tierColor: true, tierLogoScale: true },
  });
}

beforeAll(async () => {
  const featured = await getFeaturedEdition();
  if (!featured) throw new Error("seed missing a featured edition");
  currentYear = featured.year;
  tierId = (await prisma.sponsorTier.create({
    data: { key: `tier-rename-${stamp}`, nameFr: "Médias", nameEn: "Media", color: "#111111", logoScale: 0.8 },
  })).id;
  pastEditionId = (await prisma.edition.create({ data: { year: PAST_YEAR, status: "SEE_YOU_NEXT_YEAR" } })).id;
});

afterAll(async () => {
  if (sponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: sponsorIds } } });
  if (tierId !== undefined) await prisma.sponsorTier.deleteMany({ where: { id: tierId } });
  if (pastEditionId !== undefined) await prisma.edition.deleteMany({ where: { id: pastEditionId } });
});

describe("PUT /api/admin/sponsor-tiers/:id on frozen participations (#693)", () => {
  it("should carry the new appearance to the current edition and leave the archive alone", async () => {
    const featured = (await getFeaturedEdition())!;
    const before = await sponsorOn(featured.id, "before", true);
    const after = await sponsorOn(featured.id, "after", false);
    const archived = await sponsorOn(pastEditionId!, "archived", true);
    // Not frozen yet (a participation from before #375 reads the live tier):
    // it must be frozen with what it showed, or the rename repaints it.
    const archivedUnfrozen = await sponsorOn(pastEditionId!, "archived-unfrozen", false);

    vi.mocked(revalidatePaths).mockClear();
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsor-tiers/${tierId}`,
      payload: { nameFr: "Partenaires", nameEn: "Partners", color: "#222222", logoScale: 1.2 },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    const renamed = { tierNameFr: "Partenaires", tierNameEn: "Partners", tierColor: "#222222", tierLogoScale: 1.2 };
    const original = { tierNameFr: "Médias", tierNameEn: "Media", tierColor: "#111111", tierLogoScale: 0.8 };
    expect(await participationOf(before.id)).toEqual(renamed);
    expect(await participationOf(after.id)).toEqual(renamed);
    expect(await participationOf(archived.id)).toEqual(original);
    expect(await participationOf(archivedUnfrozen.id)).toEqual(original);

    // The pages that show the current sponsors' tier, not only the wall.
    const purged = vi.mocked(revalidatePaths).mock.calls.flatMap(([paths]) => paths ?? []);
    expect(purged).toEqual(expect.arrayContaining([
      `/fr/sponsors/${before.slug}`,
      `/en/sponsors/${after.slug}`,
      `/fr/editions/${currentYear}`,
      "/fr/sponsors/hall-of-fame",
    ]));
    expect(purged).not.toContain(`/fr/sponsors/${archived.slug}`);
  });

  it("should leave participations alone when the appearance is not sent", async () => {
    const featured = (await getFeaturedEdition())!;
    const sponsor = await sponsorOn(featured.id, "untouched", true);
    const frozen = await participationOf(sponsor.id);

    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsor-tiers/${tierId}`,
      payload: { rank: 7 },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    expect(await participationOf(sponsor.id)).toEqual(frozen);
  });
});
