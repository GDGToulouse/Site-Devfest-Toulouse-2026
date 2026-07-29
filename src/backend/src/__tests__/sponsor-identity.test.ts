import { describe, it, expect, afterEach } from "vitest";

import { prisma } from "../lib/prisma.js";

import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #129 — a sponsor is a company, not a per-edition row. The slug is global and
// participation lives on EditionSponsor. These are the invariants the rest of
// the sponsor work (#130, #131, #132) is allowed to assume.

const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];

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
    // 1900, NOT a future year: getSeededEdition() picks the most recent edition
    // at or after 2016, so a 2999 row would be handed to whichever parallel
    // test file asked for an edition while this one still existed — exactly the
    // #292 race that helper was written to close. Below 2016 it is invisible.
    const other = await prisma.edition.create({ data: { year: 1900 } });
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
    expect(years.map((p) => p.edition.year).sort()).toEqual([edition.year, 1900].sort());
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
