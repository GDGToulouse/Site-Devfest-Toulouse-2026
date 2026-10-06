import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "../lib/prisma.js";
import { listFileUsages } from "../lib/trash-files.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// #483 — the media library names what each file is used by ("photo of Marie
// Dupont"), derived from the columns that point at /uploads/, never typed in:
// it stays true when a photo moves to another speaker.

const stamp = Date.now();
const PHOTO = `/uploads/test-483-photo-${stamp}.jpg`;
const LOGO = `/uploads/test-483-logo-${stamp}.png`;
const UNUSED = `/uploads/test-483-unused-${stamp}.png`;

const created = { speakerIds: [] as number[], sponsorIds: [] as number[] };

afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { id: { in: created.speakerIds } } });
  await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
});

describe("listFileUsages (#483)", () => {
  it("should name every row using each file, and nothing for an unused one", async () => {
    const speaker = await prisma.speaker.create({
      data: { name: "Marie Test483", slug: `marie-test483-${stamp}`, photoUrl: PHOTO },
    });
    created.speakerIds.push(speaker.id);
    const edition = await getSeededEdition();
    const sponsor = await createSponsorFixture({
      name: "Acme Test483", slug: `acme-test483-${stamp}`, editionId: edition.id, tierId: await tierIdByKey("gold"),
    });
    created.sponsorIds.push(sponsor.id);
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { logoUrl: LOGO } });
    await prisma.editionSponsor.updateMany({ where: { sponsorId: sponsor.id }, data: { logoUrl: LOGO } });

    const usages = await listFileUsages([PHOTO, LOGO, UNUSED]);

    expect(usages.get(PHOTO)).toEqual([{ model: "speaker", id: speaker.id, label: "Marie Test483", isTrashed: false }]);
    expect(usages.get(LOGO)).toEqual(
      expect.arrayContaining([
        { model: "sponsor", id: sponsor.id, label: "Acme Test483", isTrashed: false },
        expect.objectContaining({ model: "editionSponsor", label: `Acme Test483 (${edition.year})` }),
      ]),
    );
    expect(usages.get(UNUSED)).toBeUndefined();
  });

  it("should still name a row sitting in the trash, flagged as such", async () => {
    const url = `/uploads/test-483-trashed-${stamp}.jpg`;
    const speaker = await prisma.speaker.create({
      data: { name: "Trashed Test483", slug: `trashed-test483-${stamp}`, photoUrl: url, deletedAt: new Date() },
    });
    created.speakerIds.push(speaker.id);

    const usages = await listFileUsages([url]);

    expect(usages.get(url)).toEqual([{ model: "speaker", id: speaker.id, label: "Trashed Test483", isTrashed: true }]);
  });
});
