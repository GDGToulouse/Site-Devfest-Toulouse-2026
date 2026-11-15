import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { yearParamsSchema } from "../lib/public-params.js";
import { buildCalendar, type CalendarEvent } from "../lib/ics.js";
import { buildScheduleXml, type ScheduleTalk } from "../lib/schedule-xml.js";
import { APP_VERSION } from "../lib/version.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// The schedule as a calendar file (#443).
//
// Same data as GET /editions/:year/schedule, another shape: what a participant
// puts on their phone. `?talks=` narrows it to the selection #442 carries in
// the page URL — the whole programme when the parameter is absent.
export default async function calendarRoutes(app: FastifyInstance) {
  app.get<{ Params: { year: string }; Querystring: { talks?: string } }>(
    "/editions/:year/schedule.ics",
    {
      schema: {
        params: yearParamsSchema(),
        querystring: {
          type: "object",
          properties: { talks: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const yearNum = Number(request.params.year);

      const edition = await prisma.edition.findFirst({
        where: { year: yearNum, ...notDeleted },
        select: { id: true, year: true, venue: { select: { name: true, address: true } } },
      });
      if (!edition) return reply.status(404).send({ error: "Edition not found" });

      // Same ceiling as the page (#442): a hand-edited querystring must not turn
      // into an unbounded `IN (…)`.
      const wanted = (request.query.talks ?? "")
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean)
        .slice(0, 60);

      const talks = await prisma.talk.findMany({
        where: {
          editionId: edition.id,
          publicationStatus: "PUBLISHED",
          // A session with no time cannot be an event: the 244 imported
          // historical talks have none.
          startsAt: { not: null },
          ...(wanted.length > 0 ? { slug: { in: wanted } } : {}),
          ...notDeleted,
        },
        orderBy: [{ startsAt: "asc" }, { title: "asc" }],
        select: {
          slug: true,
          title: true,
          roomLabel: true,
          startsAt: true,
          endsAt: true,
          updatedAt: true,
          speakers: {
            where: {
              ...notDeleted,
              editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
            },
            select: { name: true },
            orderBy: { name: "asc" },
          },
        },
      });

      const venue = [edition.venue?.name, edition.venue?.address].filter(Boolean).join(", ");

      const events: CalendarEvent[] = talks.map((talk) => {
        const url = `${BASE_URL}/fr/conferences/${talk.slug}`;
        const speakers = talk.speakers.map((s) => s.name).join(", ");

        return {
          // Scoped by year as well as slug: a slug is unique per edition, not
          // across them, and two years of DevFest must not collide in someone's
          // calendar.
          uid: `${talk.slug}-${edition.year}@devfesttoulouse.fr`,
          start: talk.startsAt!,
          end: talk.endsAt,
          summary: talk.title,
          location: [talk.roomLabel, venue].filter(Boolean).join(" — "),
          description: [speakers, url].filter(Boolean).join("\n"),
          url,
          sequence: Math.floor(talk.updatedAt.getTime() / 1000),
        };
      });

      const calendar = buildCalendar(events, {
        calendarName: `DevFest Toulouse ${edition.year}`,
        stamp: new Date(),
      });

      return reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="devfest-toulouse-${edition.year}.ics"`,
        )
        .send(calendar);
    },
  );
  // The programme as a schedule.xml (#827), for the conference apps (Giggity,
  // EventFahrplan…). Same sessions as the .ics: published, with a time. Each
  // session sits in its own room only: a keynote relayed elsewhere (#456)
  // would otherwise appear twice under one guid, which the format forbids.
  app.get<{ Params: { year: string } }>(
    "/editions/:year/schedule.xml",
    { schema: { params: yearParamsSchema() } },
    async (request, reply) => {
      const edition = await prisma.edition.findFirst({
        where: { year: Number(request.params.year), ...notDeleted },
        select: { id: true, year: true },
      });
      if (!edition) return reply.status(404).send({ error: "Edition not found" });

      const talks = await prisma.talk.findMany({
        where: { editionId: edition.id, publicationStatus: "PUBLISHED", startsAt: { not: null }, ...notDeleted },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          format: true,
          language: true,
          startsAt: true,
          endsAt: true,
          roomLabel: true,
          updatedAt: true,
          room: { select: { name: true, sortOrder: true } },
          category: { select: { nameFr: true } },
          speakers: {
            where: {
              ...notDeleted,
              editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
      });

      const scheduleTalks: ScheduleTalk[] = talks.map((talk) => ({
        id: talk.id,
        slug: talk.slug,
        title: talk.title,
        description: talk.description,
        format: talk.format,
        language: talk.language,
        start: talk.startsAt!,
        end: talk.endsAt,
        // The label frozen when the session was placed (#375), as on the grid.
        room: talk.roomLabel ?? talk.room?.name ?? "DevFest",
        roomOrder: talk.room?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        track: talk.category?.nameFr ?? null,
        speakers: talk.speakers,
        url: `${BASE_URL}/fr/conferences/${talk.slug}`,
      }));
      // The last edit of any session: an app that kept an older version refreshes.
      const lastEdit = talks.reduce((max, t) => Math.max(max, t.updatedAt.getTime()), 0);

      const xml = buildScheduleXml(
        { year: edition.year, baseUrl: BASE_URL, generatorVersion: APP_VERSION, version: new Date(lastEdit).toISOString() },
        scheduleTalks,
      );
      return reply.header("Content-Type", "application/xml; charset=utf-8").send(xml);
    },
  );
}
