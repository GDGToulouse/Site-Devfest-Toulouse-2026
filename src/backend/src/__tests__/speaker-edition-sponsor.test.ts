import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import speakerRoutes from "../routes/speakers.js";
import { prisma } from "../lib/prisma.js";

// #353 — the sponsor association moved from Speaker to SpeakerEdition. Working
// for a sponsor is true of a given year, and Sponsor is edition-scoped itself,
// so both ends of the link are now dated to the same edition.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(speakerRoutes, { prefix: "/api" });
  return app;
}

const createdSpeakerIds: number[] = [];
const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];
const uniq = () => `${Date.now()}-${Math.round(performance.now())}`;

afterEach(async () => {
  if (createdSpeakerIds.length) {
    await prisma.speaker.deleteMany({ where: { id: { in: createdSpeakerIds } } });
    createdSpeakerIds.length = 0;
  }
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

async function makeEdition(year: number) {
  const edition = await prisma.edition.create({
    data: { year, status: "SEE_YOU_NEXT_YEAR" },
  });
  createdEditionIds.push(edition.id);
  return edition;
}

async function makeSponsor(editionId: number, name: string, { publicationStatus = "PUBLISHED" as const } = {}) {
  // Sponsor needs a tier; reuse whichever the catalogue already holds.
  const tier = await prisma.sponsorTier.findFirstOrThrow();
  const sponsor = await prisma.sponsor.create({
    data: {
      editionId,
      tierId: tier.id,
      name,
      slug: `sponsor-${name.toLowerCase().replace(/\W+/g, "-")}-${uniq()}`,
      publicationStatus,
    },
  });
  createdSponsorIds.push(sponsor.id);
  return sponsor;
}

async function makePerson(
  name: string,
  participations: { editionId: number; sponsorId?: number | null }[],
) {
  const speaker = await prisma.speaker.create({
    data: {
      name,
      slug: `sponsored-${name.toLowerCase().replace(/\W+/g, "-")}-${uniq()}`,
      editions: {
        create: participations.map((p) => ({
          editionId: p.editionId,
          publicationStatus: "PUBLISHED",
          sponsorId: p.sponsorId ?? null,
        })),
      },
    },
  });
  createdSpeakerIds.push(speaker.id);
  return speaker;
}

async function fetchSpeaker(slug: string) {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: `/api/speakers/${slug}` });
  await app.close();
  return res;
}

describe("Speaker sponsor per edition (#353)", () => {
  it("shows the employer of each year, not the latest one", async () => {
    // The bug the move fixes: one global sponsorId could only ever name one
    // employer, so this person's 2019 page showed their 2026 company.
    const older = await makeEdition(1701);
    const newer = await makeEdition(1702);
    const firstJob = await makeSponsor(older.id, "Former Employer");
    const secondJob = await makeSponsor(newer.id, "Current Employer");

    const person = await makePerson("Changed Jobs", [
      { editionId: older.id, sponsorId: firstJob.id },
      { editionId: newer.id, sponsorId: secondJob.id },
    ]);

    const res = await fetchSpeaker(person.slug);

    const participations = res.json().participations;
    expect(participations.find((p: { year: number }) => p.year === 1702).sponsor.name).toBe("Current Employer");
    expect(participations.find((p: { year: number }) => p.year === 1701).sponsor.name).toBe("Former Employer");
  });

  it("leaves the sponsor null on a year with no association", async () => {
    const withJob = await makeEdition(1703);
    const without = await makeEdition(1704);
    const sponsor = await makeSponsor(withJob.id, "Only That Year");

    const person = await makePerson("Sometimes Employed", [
      { editionId: withJob.id, sponsorId: sponsor.id },
      { editionId: without.id },
    ]);

    const res = await fetchSpeaker(person.slug);

    const participations = res.json().participations;
    expect(participations.find((p: { year: number }) => p.year === 1703).sponsor.slug).toBe(sponsor.slug);
    expect(participations.find((p: { year: number }) => p.year === 1704).sponsor).toBeNull();
  });

  it("hides a sponsor that is not published", async () => {
    const edition = await makeEdition(1705);
    const draft = await makeSponsor(edition.id, "Draft Sponsor", { publicationStatus: "DRAFT" });

    const person = await makePerson("Draft Sponsor Employee", [
      { editionId: edition.id, sponsorId: draft.id },
    ]);

    const res = await fetchSpeaker(person.slug);

    // Public pages never surface an unpublished sponsor, here no more than
    // anywhere else.
    expect(res.json().participations[0].sponsor).toBeNull();
  });

  it("hides a trashed sponsor", async () => {
    const edition = await makeEdition(1706);
    const sponsor = await makeSponsor(edition.id, "Trashed Sponsor");
    const person = await makePerson("Trashed Sponsor Employee", [
      { editionId: edition.id, sponsorId: sponsor.id },
    ]);
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { deletedAt: new Date() } });

    const res = await fetchSpeaker(person.slug);

    expect(res.json().participations[0].sponsor).toBeNull();
  });

  it("keeps the participation when the sponsor is deleted", async () => {
    const edition = await makeEdition(1707);
    const sponsor = await makeSponsor(edition.id, "Doomed Sponsor");
    const person = await makePerson("Survivor", [{ editionId: edition.id, sponsorId: sponsor.id }]);

    // onDelete: SetNull — removing a sponsor clears the link, it does not take
    // the participation (and with it the speaker's year) down with it.
    await prisma.sponsor.delete({ where: { id: sponsor.id } });
    createdSponsorIds.length = 0;

    const link = await prisma.speakerEdition.findUniqueOrThrow({
      where: { speakerId_editionId: { speakerId: person.id, editionId: edition.id } },
    });
    expect(link.sponsorId).toBeNull();
  });
});
