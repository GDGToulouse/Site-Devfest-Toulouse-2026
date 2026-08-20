import { describe, it, expect, afterEach } from "vitest";

import { prisma } from "../lib/prisma.js";

import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #129 — a sponsor is a company, not a per-edition row. The slug is global and
// participation lives on EditionSponsor. These are the invariants the rest of
// the sponsor work (#130, #131, #132) is allowed to assume.

const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];
const createdTierIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    // EditionSponsor and SponsorJobOffer cascade from Sponsor. Delete sponsors
    // first so their participations are gone before we delete the edition.
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
  // Last: EditionSponsor.tierId holds a tier until its participations are gone.
  if (createdTierIds.length) {
    await prisma.sponsorTier.deleteMany({ where: { id: { in: createdTierIds } } });
    createdTierIds.length = 0;
  }
});

describe("Sponsor identity (#129)", () => {
  it("rejects a second sponsor with the same slug, whatever the edition", async () => {
    const slug = `identity-dup-${Date.now()}`;
    const first = await prisma.sponsor.create({ data: { name: "Acme", slug } });
    createdSponsorIds.push(first.id);

    await expect(
      prisma.sponsor.create({ data: { name: "Acme Again", slug } }),
    ).rejects.toThrow();
  });

  it("carries one company across two editions as two participations", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    // year is the only required field on Edition, and it is @unique.
    //
    // 1750, NOT a future year: getSeededEdition() picks the most recent edition
    // at or after 2016, so a 2999 row would be handed to whichever parallel
    // test file asked for an edition while this one still existed — exactly the
    // #292 race that helper was written to close. Below 2016 it is invisible.
    //
    // Test files each own a year block so two of them never collide on the
    // @unique year: 16xx and 1990 are taken, 19xx by the speaker files. 17xx
    // is this file's.
    const other = await prisma.edition.create({ data: { year: 1750 } });
    createdEditionIds.push(other.id);

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Multi Year Co",
        slug: `identity-multi-${Date.now()}`,
        editions: {
          create: [
            { editionId: edition.id, tierId, publicationStatus: "PUBLISHED" },
            { editionId: other.id, tierId, publicationStatus: "DRAFT" },
          ],
        },
      },
      include: { editions: true },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.editions).toHaveLength(2);

    const years = await prisma.editionSponsor.findMany({
      where: { sponsorId: sponsor.id },
      select: { edition: { select: { year: true } }, publicationStatus: true },
    });
    expect(years.map((p) => p.edition.year).sort()).toEqual([edition.year, 1750].sort());

    // Publication is per participation, not per company: the same sponsor is
    // live on one edition and still a draft on the other.
    const byYear = new Map(years.map((p) => [p.edition.year, p.publicationStatus]));
    expect(byYear.get(edition.year)).toBe("PUBLISHED");
    expect(byYear.get(1750)).toBe("DRAFT");
  });

  it("refuses two participations of one company on the same edition", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Once Per Year Co",
        slug: `identity-once-${Date.now()}`,
        editions: { create: [{ editionId: edition.id, tierId }] },
      },
    });
    createdSponsorIds.push(sponsor.id);

    await expect(
      prisma.editionSponsor.create({ data: { sponsorId: sponsor.id, editionId: edition.id, tierId } }),
    ).rejects.toThrow();
  });

  it("hangs job offers off the participation, not the company", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Hiring Co",
        slug: `identity-offers-${Date.now()}`,
        editions: {
          create: [{
            editionId: edition.id,
            tierId,
            jobOffers: { create: [{ title: "Dev", url: "https://example.org/job" }] },
          }],
        },
      },
      include: { editions: { include: { jobOffers: true } } },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.editions[0].jobOffers).toHaveLength(1);
    expect(sponsor.editions[0].jobOffers[0].title).toBe("Dev");
  });

  // #375 — the identity/participation split moved the logo off the year it
  // belonged to. What an edition displayed is frozen on its participation, so
  // neither the company nor the shared tier catalogue can rewrite an archive.

  it("keeps a past edition's logo when the company changes its own", async () => {
    const tierId = await tierIdByKey("gold");
    const past = await prisma.edition.create({ data: { year: 1751 } });
    createdEditionIds.push(past.id);

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Rebranding Co",
        slug: `archive-logo-${Date.now()}`,
        logoUrl: "/logos/old.svg",
        editions: { create: [{ editionId: past.id, tierId, logoUrl: "/logos/old.svg" }] },
      },
    });
    createdSponsorIds.push(sponsor.id);

    await prisma.sponsor.update({
      where: { id: sponsor.id },
      data: { logoUrl: "/logos/new.svg" },
    });

    const participation = await prisma.editionSponsor.findFirstOrThrow({
      where: { sponsorId: sponsor.id, editionId: past.id },
    });
    expect(participation.logoUrl).toBe("/logos/old.svg");
  });

  it("keeps a past edition's tier label when the catalogue is renamed", async () => {
    const past = await prisma.edition.create({ data: { year: 1752 } });
    createdEditionIds.push(past.id);

    // A throwaway tier: renaming a seeded one would leak into other test files.
    const tier = await prisma.sponsorTier.create({
      data: { key: `archive-tier-${Date.now()}`, nameFr: "Or", nameEn: "Gold", color: "#d4af37" },
    });
    createdTierIds.push(tier.id);

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Frozen Tier Co",
        slug: `archive-tier-${Date.now()}`,
        editions: {
          create: [{
            editionId: past.id,
            tierId: tier.id,
            tierNameFr: tier.nameFr,
            tierNameEn: tier.nameEn,
            tierColor: tier.color,
          }],
        },
      },
    });
    createdSponsorIds.push(sponsor.id);

    await prisma.sponsorTier.update({
      where: { id: tier.id },
      data: { nameFr: "Platine", nameEn: "Platinum", color: "#e5e4e2" },
    });

    const participation = await prisma.editionSponsor.findFirstOrThrow({
      where: { sponsorId: sponsor.id, editionId: past.id },
    });
    expect(participation.tierNameFr).toBe("Or");
    expect(participation.tierNameEn).toBe("Gold");
    expect(participation.tierColor).toBe("#d4af37");
  });

  it("keeps contacts on the company, shared across its editions", async () => {
    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Contactable Co",
        slug: `identity-contact-${Date.now()}`,
        contacts: { create: [{ email: "boss@example.org" }] },
      },
      include: { contacts: true },
    });
    createdSponsorIds.push(sponsor.id);

    expect(sponsor.contacts).toHaveLength(1);
    expect(sponsor.contacts[0].email).toBe("boss@example.org");
  });
});
