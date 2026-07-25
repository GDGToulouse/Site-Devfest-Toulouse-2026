import type { FastifyInstance } from "fastify";
import type { Prisma } from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";
import { notDeleted, visibleCategory } from "../lib/admin-helpers.js";

/**
 * Hall of replays (#102) — every filmed talk, all editions at once.
 *
 * The per-edition route (/editions/:year/talks) already exposes `videoUrl`, but
 * browsing a talk seen "two or three years ago" meant opening each edition in
 * turn. This aggregates them and filters server-side, so the page stays SSR and
 * indexable rather than shipping ~244 rows to the browser to filter there.
 */

// One page holds the whole catalogue comfortably (~244 filmed talks today), but
// an unbounded query would degrade silently as editions pile up. The cap is
// generous and reported, never a silent truncation.
const MAX_LIMIT = 500;

export default async function replayRoutes(app: FastifyInstance) {
  // GET /api/replays?q=&year=&format=&category=
  app.get<{
    Querystring: { q?: string; year?: string; format?: string; category?: string; limit?: string };
  }>("/replays", async (request, reply) => {
    const { q, year, format, category } = request.query;

    if (year && isNaN(Number(year))) {
      return reply.status(400).send({ error: "Invalid year" });
    }

    const limit = Math.min(Number(request.query.limit) || MAX_LIMIT, MAX_LIMIT);

    // A replay is a published, non-trashed talk that actually has a video.
    // `not: null` alone would keep rows storing an empty string.
    const where: Prisma.TalkWhereInput = {
      publicationStatus: "PUBLISHED",
      videoUrl: { not: null },
      ...notDeleted,
      // One `edition` key only: spreading a second one would silently drop the
      // trash filter when a year is selected.
      edition: { ...notDeleted, ...(year ? { year: Number(year) } : {}) },
      ...(format ? { format: format as Prisma.TalkWhereInput["format"] } : {}),
      ...(category ? { category: { is: { nameFr: category, ...notDeleted } } } : {}),
      // Search spans the talk title and its speakers' names: the visitor may
      // remember either one, rarely both.
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { speakers: { some: { name: { contains: q, mode: "insensitive" as const }, ...notDeleted } } },
            ],
          }
        : {}),
    };

    const talks = await prisma.talk.findMany({
      where,
      take: limit,
      // Newest edition first, then alphabetical: the most recent replays are
      // the ones visitors look for most.
      orderBy: [{ edition: { year: "desc" } }, { title: "asc" }],
      include: {
        edition: { select: { year: true } },
        // Nested filter: a trashed speaker must not ride along a live talk (#147).
        speakers: {
          where: { publicationStatus: "PUBLISHED", ...notDeleted },
          select: { slug: true, name: true, photoUrl: true },
          orderBy: { name: "asc" },
        },
        category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
      },
    });

    return talks.map((t) => ({
      slug: t.slug,
      title: t.title,
      format: t.format,
      language: t.language,
      videoUrl: t.videoUrl,
      year: t.edition.year,
      category: visibleCategory(t.category),
      speakers: t.speakers,
    }));
  });

  // GET /api/replays/filters — the values that actually have replays behind
  // them, so the UI never offers a filter leading to an empty list.
  app.get("/replays/filters", async () => {
    const talks = await prisma.talk.findMany({
      where: { publicationStatus: "PUBLISHED", videoUrl: { not: null }, ...notDeleted, edition: notDeleted },
      select: {
        format: true,
        edition: { select: { year: true } },
        category: { select: { nameFr: true, nameEn: true, deletedAt: true } },
      },
    });

    const years = [...new Set(talks.map((t) => t.edition.year))].sort((a, b) => b - a);
    const formats = [...new Set(talks.map((t) => t.format))].sort();

    // Deduplicate by French name: the same category exists once per edition, so
    // the raw list repeats it for every year that used it.
    const byName = new Map<string, { nameFr: string; nameEn: string }>();
    for (const t of talks) {
      const c = visibleCategory(t.category);
      if (c) byName.set(c.nameFr, { nameFr: c.nameFr, nameEn: c.nameEn });
    }
    const categories = [...byName.values()].sort((a, b) => a.nameFr.localeCompare(b.nameFr));

    return { years, formats, categories, total: talks.length };
  });
}
