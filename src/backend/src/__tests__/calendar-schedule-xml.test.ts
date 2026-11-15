import { describe, it, expect, beforeAll, afterAll } from "vitest";

import Fastify, { type FastifyInstance } from "fastify";
import calendarRoutes from "../routes/calendar.js";
import { prisma } from "../lib/prisma.js";

// The programme as a schedule.xml for conference apps (#827): what reaches the
// file. Its grammar is covered in lib/schedule-xml.test.ts.

// A past year of its own (#292).
const TEST_YEAR = 1827;

let app: FastifyInstance;
let editionId: number;
let speakerIds: number[] = [];
let scheduledId: number;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(calendarRoutes, { prefix: "/api" });

  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR, status: "PREPARATION" } })).id;
  const published = await prisma.speaker.create({
    data: {
      slug: `ada-xml-${TEST_YEAR}`,
      name: "Ada Programme",
      editions: { create: { editionId, publicationStatus: "PUBLISHED" } },
    },
  });
  const draft = await prisma.speaker.create({
    data: {
      slug: `bob-xml-${TEST_YEAR}`,
      name: "Bob Brouillon",
      editions: { create: { editionId, publicationStatus: "DRAFT" } },
    },
  });
  speakerIds = [published.id, draft.id];

  const base = { editionId, description: "", format: "CONFERENCE" as const, language: "fr" };
  scheduledId = (
    await prisma.talk.create({
      data: {
        ...base,
        slug: "session-au-programme",
        title: "Session au programme",
        publicationStatus: "PUBLISHED",
        roomLabel: "Amphithéâtre",
        startsAt: new Date("1827-11-19T08:50:00.000Z"),
        endsAt: new Date("1827-11-19T09:30:00.000Z"),
        speakers: { connect: [{ id: published.id }, { id: draft.id }] },
      },
    })
  ).id;
  await prisma.talk.create({
    data: { ...base, slug: "session-sans-horaire", title: "Session sans horaire", publicationStatus: "PUBLISHED" },
  });
  await prisma.talk.create({
    data: {
      ...base,
      slug: "session-brouillon",
      title: "Session brouillon",
      publicationStatus: "DRAFT",
      startsAt: new Date("1827-11-19T10:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) {
    await prisma.talk.deleteMany({ where: { editionId } });
    await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
    await prisma.edition.delete({ where: { id: editionId } });
  }
});

const get = (year: number | string) => app.inject({ method: "GET", url: `/api/editions/${year}/schedule.xml` });

describe("GET /editions/:year/schedule.xml (#827)", () => {
  it("should serve an XML schedule", async () => {
    const res = await get(TEST_YEAR);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.body).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<schedule>/);
  });

  it("should carry only the published sessions that have a time", async () => {
    const res = await get(TEST_YEAR);

    expect(res.body).toContain("<title>Session au programme</title>");
    expect(res.body).not.toContain("Session sans horaire");
    expect(res.body).not.toContain("Session brouillon");
  });

  it("should leave out a speaker who is not published for the edition", async () => {
    const res = await get(TEST_YEAR);

    expect(res.body).toContain("Ada Programme");
    expect(res.body).not.toContain("Bob Brouillon");
  });

  it("should keep a session's guid when the session changes", async () => {
    const before = /<event id="\d+" guid="([^"]+)">/.exec((await get(TEST_YEAR)).body)?.[1];
    await prisma.talk.update({ where: { id: scheduledId }, data: { title: "Session renommée" } });

    const after = /<event id="\d+" guid="([^"]+)">/.exec((await get(TEST_YEAR)).body)?.[1];

    expect(before).toBeDefined();
    expect(after).toBe(before);
  });

  it("should answer 404 for a year that has no edition", async () => {
    const res = await get(1066);

    expect(res.statusCode).toBe(404);
  });
});
