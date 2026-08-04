import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted, parseSocialLinks } from "../lib/admin-helpers.js";

export default async function speakerRoutes(app: FastifyInstance) {
  // GET /api/speakers — published speakers of the featured edition, alphabetical.
  app.get("/speakers", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // Read through the participations since #351, then project back to the
    // exact same response shape: the public payload must not change.
    const links = await prisma.speakerEdition.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", speaker: notDeleted },
      orderBy: { speaker: { name: "asc" } },
      select: {
        isFeatured: true,
        speaker: {
          select: { id: true, slug: true, name: true, photoUrl: true, company: true },
        },
      },
    });
    return links.map((link) => ({ ...link.speaker, isFeatured: link.isFeatured }));
  });

  // GET /api/speakers/featured — published + featured speakers (home section, US-202).
  app.get("/speakers/featured", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const links = await prisma.speakerEdition.findMany({
      where: {
        editionId: edition.id,
        publicationStatus: "PUBLISHED",
        isFeatured: true,
        speaker: notDeleted,
      },
      orderBy: { speaker: { name: "asc" } },
      take: 8,
      select: {
        speaker: { select: { id: true, slug: true, name: true, photoUrl: true, company: true } },
      },
    });
    return links.map((link) => link.speaker);
  });

  // GET /api/speakers/hall-of-fame — everyone who ever spoke, all editions.
  //
  // Declared before "/speakers/:slug" for readability only: find-my-way gives
  // static segments priority over parametric ones, so the order does not matter
  // — but it does mean "hall-of-fame" can never be a person's slug.
  app.get("/speakers/hall-of-fame", async () => {
    // Read through the participations rather than the people: one query returns
    // every (person, year) pair, which is then folded in memory. Going the other
    // way (speaker.findMany + nested include) ships a heavier nested payload for
    // the same result.
    const links = await prisma.speakerEdition.findMany({
      where: { publicationStatus: "PUBLISHED", speaker: notDeleted, edition: notDeleted },
      orderBy: [{ speaker: { name: "asc" } }, { edition: { year: "desc" } }],
      // A guard, not a real limit: ~240 people today, growing by ~40 a year. An
      // unbounded query on a table that keeps growing is what replays.ts avoids.
      take: 2000,
      select: {
        edition: { select: { year: true } },
        speaker: { select: { slug: true, name: true, photoUrl: true, company: true } },
      },
    });

    const people = new Map<string, { slug: string; name: string; photoUrl: string | null; company: string | null; years: number[] }>();
    for (const link of links) {
      const entry = people.get(link.speaker.slug);
      if (entry) {
        entry.years.push(link.edition.year);
      } else {
        people.set(link.speaker.slug, { ...link.speaker, years: [link.edition.year] });
      }
    }
    return [...people.values()];
  });

  // GET /api/speakers/:slug — the person's page. Not scoped to an edition since
  // #352: a slug identifies a human, so anyone published on any edition has a
  // page. Talks come grouped by participation, because 19 published people have
  // no talk at all — a flat talk list cannot say "took part in 2018, no session".
  app.get<{ Params: { slug: string } }>("/speakers/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const speaker = await prisma.speaker.findFirst({
      where: {
        slug: request.params.slug,
        ...notDeleted,
        editions: { some: { publicationStatus: "PUBLISHED", edition: notDeleted } },
      },
      include: {
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only).
        //
        // `edition: notDeleted` is required here since #352: the route used to
        // resolve getFeaturedEdition(), which already filtered the trash. Now
        // that it spans every year, a trashed edition would resurface.
        editions: {
          where: { publicationStatus: "PUBLISHED", edition: notDeleted },
          select: {
            isFeatured: true,
            editionId: true,
            edition: { select: { year: true } },
            // Per-edition since #353: the employer of that year, not the latest
            // one. publicationStatus left the identity for the participation
            // (#129), so "published" now means published for THAT year, not any
            // year — a sponsor in draft for 2019 must not surface on a 2019 card
            // merely because it is published in 2026. A to-one relation takes no
            // `where` in a select, hence the nested participation list here.
            sponsor: {
              select: {
                slug: true,
                name: true,
                deletedAt: true,
                editions: { select: { editionId: true, publicationStatus: true } },
              },
            },
          },
          orderBy: { edition: { year: "desc" } },
        },
        talks: {
          where: { publicationStatus: "PUBLISHED", ...notDeleted, edition: notDeleted },
          // level/language/category describe the session the same way the talk
          // page does (#359). level is nullable — 42 of the imported talks carry
          // none — so the client must treat it as optional.
          select: {
            slug: true,
            title: true,
            format: true,
            level: true,
            language: true,
            videoUrl: true,
            category: { select: { nameFr: true, nameEn: true, color: true } },
            edition: { select: { year: true } },
          },
          orderBy: { title: "asc" },
        },
      },
    });

    if (!speaker) return reply.status(404).send({ error: "Speaker not found" });

    // Talks are filed into the years the person is actually published on. A talk
    // whose year has no published participation is dropped, never given a
    // section of its own — otherwise a draft year would leak through its talks.
    const byYear = new Map(speaker.editions.map((link) => [link.edition.year, [] as typeof speaker.talks]));
    for (const talk of speaker.talks) {
      byYear.get(talk.edition.year)?.push(talk);
    }

    return {
      id: speaker.id,
      slug: speaker.slug,
      name: speaker.name,
      photoUrl: speaker.photoUrl,
      company: speaker.company,
      city: speaker.city,
      bioFr: speaker.bioFr,
      bioEn: speaker.bioEn,
      socialLinks: parseSocialLinks(speaker.socialLinks),
      participations: speaker.editions.map((link) => ({
        year: link.edition.year,
        isFeatured: link.isFeatured,
        // The employer of that year (#353). Hidden unless the sponsor is out of
        // the trash and published for THIS year specifically — not "published on
        // any year" (#129 moved publicationStatus off the identity).
        sponsor: (() => {
          if (!link.sponsor || link.sponsor.deletedAt) return null;
          const thatYear = link.sponsor.editions.find((e) => e.editionId === link.editionId);
          return thatYear?.publicationStatus === "PUBLISHED"
            ? { slug: link.sponsor.slug, name: link.sponsor.name }
            : null;
        })(),
        talks: (byYear.get(link.edition.year) ?? []).map(({ edition, ...talk }) => talk),
      })),
    };
  });
}
