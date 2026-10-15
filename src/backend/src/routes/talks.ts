import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted, visibleCategory } from "../lib/admin-helpers.js";

// A talk of the featured edition, shared by the public route and the team's
// draft preview (#618): `includeDrafts` lifts the publication filters on the
// talk and its speakers, never the trash ones.
export async function findFeaturedTalkPage(
  edition: { id: number; year: number },
  slug: string,
  { includeDrafts = false } = {},
) {
  const published = includeDrafts ? {} : ({ publicationStatus: "PUBLISHED" } as const);
  const talk = await prisma.talk.findFirst({
    where: {
      editionId: edition.id,
      slug,
      ...published,
      ...notDeleted,
    },
    include: {
      // Nested reads need their own filter: a query extension would not reach
      // them (Prisma applies those to the top-level operation only), and a
      // trashed speaker would otherwise still show up on a live talk page.
      speakers: {
        // Published *for this edition* (#351): the status moved onto the
        // participation, so the filter goes through it.
        where: {
          ...notDeleted,
          editions: { some: { editionId: edition.id, ...published } },
        },
        select: { slug: true, name: true, photoUrl: true, company: true },
        orderBy: { name: "asc" },
      },
      // `category` is to-one: Prisma takes no `where` there, so a trashed
      // category cannot be filtered out by the query. `deletedAt` comes along
      // and the serializer below drops it (#147).
      category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
    },
  });

  if (!talk) return null;

  return {
    id: talk.id,
    slug: talk.slug,
    title: talk.title,
    description: talk.description,
    format: talk.format,
    level: talk.level,
    language: talk.language,
    // When and where (#443): what the "add to my calendar" buttons need.
    // `room` is the label frozen when the talk was placed (#375).
    room: talk.roomLabel,
    startsAt: talk.startsAt,
    endsAt: talk.endsAt,
    year: edition.year,
    // The replay, once filmed (#633): the dated address of a featured talk now
    // redirects here, so this page has to show what that one showed.
    videoUrl: talk.videoUrl,
    category: visibleCategory(talk.category),
    speakers: talk.speakers,
  };
}

export default async function talkRoutes(app: FastifyInstance) {
  // GET /api/talks/:slug — detail of a published talk + its published speakers
  // and category. The full programme grid (rooms, time slots) is Lot 3.
  app.get<{ Params: { slug: string } }>("/talks/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const page = await findFeaturedTalkPage(edition, request.params.slug);
    if (!page) return reply.status(404).send({ error: "Talk not found" });
    return page;
  });
}
