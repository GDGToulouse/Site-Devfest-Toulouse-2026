import { describe, it, expect, beforeEach, afterEach } from "vitest";

import Fastify from "fastify";
import calendarRoutes from "../routes/calendar.js";
import { prisma } from "../lib/prisma.js";

// The calendar export (#443). The file's own grammar is covered in lib/ics.test;
// what is checked here is what ends up inside it.
//
// Own venue, edition and talks rather than the seed's: 1889 because Edition.year
// is unique and the test files run in parallel — reusing a year is the #292
// failure, and it only shows in the full run.

const TEST_YEAR = 1889;

let editionId: number;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(calendarRoutes, { prefix: "/api" });
  return app;
}

beforeEach(async () => {
  const venue = await prisma.venue.create({
    data: { name: `Lieu agenda ${TEST_YEAR}`, address: "Labège" },
  });
  const edition = await prisma.edition.create({
    data: { year: TEST_YEAR, status: "PREPARATION", venueId: venue.id },
  });
  editionId = edition.id;

  await prisma.talk.create({
    data: {
      editionId,
      slug: "session-programmee",
      title: "Session programmée",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
      roomLabel: "Amphithéâtre",
      startsAt: new Date("2026-11-19T10:55:00.000Z"),
      endsAt: new Date("2026-11-19T11:35:00.000Z"),
    },
  });
  await prisma.talk.create({
    data: {
      editionId,
      slug: "session-sans-horaire",
      title: "Session sans horaire",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
    },
  });
  await prisma.talk.create({
    data: {
      editionId,
      slug: "session-brouillon",
      title: "Session brouillon",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "DRAFT",
      startsAt: new Date("2026-11-19T13:15:00.000Z"),
    },
  });
});

afterEach(async () => {
  await prisma.talk.deleteMany({ where: { editionId } });
  await prisma.edition.deleteMany({ where: { id: editionId } });
  await prisma.venue.deleteMany({ where: { name: `Lieu agenda ${TEST_YEAR}` } });
});

describe("GET /editions/:year/schedule.ics", () => {
  it("serves a calendar file, named for the year", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule.ics` });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.headers["content-disposition"]).toContain(`devfest-toulouse-${TEST_YEAR}.ics`);
    await app.close();
  });

  it("exports only the sessions that have an hour, and only the published ones", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule.ics` });

    // A VEVENT without DTSTART is invalid, and the 244 imported historical
    // talks have no time at all.
    expect(res.body).toContain("SUMMARY:Session programmée");
    expect(res.body).not.toContain("Session sans horaire");
    expect(res.body).not.toContain("Session brouillon");
    await app.close();
  });

  it("narrows to the selection when ?talks= names one", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/editions/${TEST_YEAR}/schedule.ics?talks=session-inexistante`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("BEGIN:VEVENT");
    await app.close();
  });

  it("carries the room and the venue as the location", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule.ics` });

    expect(res.body).toContain(`LOCATION:Amphithéâtre — Lieu agenda ${TEST_YEAR}\\, Labège`);
    await app.close();
  });

  it("answers 404 for a year that has no edition", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/1066/schedule.ics" });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
