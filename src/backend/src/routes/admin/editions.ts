import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateHome, revalidateEdition, revalidateSponsors } from "../../lib/revalidate.js";
import { isValidStatIcon, STAT_ICON_KEYS } from "../../lib/stat-icons.js";
import { notDeleted, softDeleteData } from "../../lib/admin-helpers.js";
import { sanitizeRichHtml, isSafeUrl } from "../../lib/sanitize.js";

interface EditionBody {
  year: number;
  startDate?: string;
  endDate?: string;
  status?: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  venueName?: string;
  venueAddress?: string;
  // Venue & practical-info page (#109). lat/lng feed the map; transports/parking
  // are rich-text HTML, sanitized on write; directionsUrl is an itinerary link.
  venueLat?: number | null;
  venueLng?: number | null;
  venueTransports?: string;
  venueParking?: string;
  venueDirectionsUrl?: string;
  heroImageUrl?: string;
  sponsorFormUrl?: string;
  aftermovieUrl?: string;
  galleryUrl?: string;
  archivedSiteUrl?: string;
  sponsorBrochureUrl?: string;
  sponsorHeroImageUrl?: string;
  sponsorPageStatus?: "PRE_ANNOUNCEMENT" | "TEMPORARY" | "OPEN" | "SOLD_OUT";
  sponsorTemporaryFormUrl?: string;
}

export default async function adminEditionRoutes(app: FastifyInstance) {
  // GET /api/admin/editions — list all editions
  app.get("/editions", async () => {
    const editions = await prisma.edition.findMany({
      where: notDeleted,
      orderBy: { year: "desc" },
      include: {
        _count: { select: { ticketTiers: { where: notDeleted }, articles: { where: notDeleted } } },
      },
    });

    return editions.map((e: (typeof editions)[number]) => ({
      id: e.id,
      year: e.year,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
      heroImageUrl: e.heroImageUrl,
      sponsorFormUrl: e.sponsorFormUrl,
      aftermovieUrl: e.aftermovieUrl,
      galleryUrl: e.galleryUrl,
      archivedSiteUrl: e.archivedSiteUrl,
      ticketTiersCount: e._count.ticketTiers,
      articlesCount: e._count.articles,
    }));
  });

  // GET /api/admin/editions/current
  app.get("/editions/current", async (_request, reply) => {
    const edition = await prisma.edition.findFirst({
      where: notDeleted,
      orderBy: { year: "desc" },
    });

    if (!edition) return reply.status(404).send({ error: "No edition found" });

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      venueName: edition.venueName,
      venueAddress: edition.venueAddress,
      heroImageUrl: edition.heroImageUrl,
      sponsorFormUrl: edition.sponsorFormUrl,
      aftermovieUrl: edition.aftermovieUrl,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
    };
  });

  // GET /api/admin/editions/featured — get the featured edition ID
  app.get("/editions/featured", async () => {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "featured_edition_id" },
    });

    return { editionId: setting ? Number(setting.value) : null };
  });

  // GET /api/admin/editions/:id — single edition by ID
  app.get<{ Params: { id: string } }>(
    "/editions/:id",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

      // findFirst: findUnique cannot carry the deletedAt filter (#147). The
      // counts drive the admin synthesis panel, so they must ignore the trash.
      const edition = await prisma.edition.findFirst({
        where: { id, ...notDeleted },
        include: {
          _count: {
            select: {
              ticketTiers: { where: notDeleted },
              articles: { where: notDeleted },
              speakers: { where: notDeleted },
              talks: { where: notDeleted },
              sponsors: { where: notDeleted },
              // `categories` is the EditionCategory join since #338: the join
              // row carries no deletedAt, so the filter targets the track.
              categories: { where: { category: notDeleted } },
            },
          },
        },
      });

      if (!edition) return reply.status(404).send({ error: "Edition not found" });

      return {
        id: edition.id,
        year: edition.year,
        startDate: edition.startDate,
        endDate: edition.endDate,
        status: edition.status,
        venueName: edition.venueName,
        venueAddress: edition.venueAddress,
        // #109 — so the admin "Lieu" tab can pre-fill these fields.
        venueLat: edition.venueLat,
        venueLng: edition.venueLng,
        venueTransports: edition.venueTransports,
        venueParking: edition.venueParking,
        venueDirectionsUrl: edition.venueDirectionsUrl,
        heroImageUrl: edition.heroImageUrl,
        sponsorFormUrl: edition.sponsorFormUrl,
        aftermovieUrl: edition.aftermovieUrl,
        galleryUrl: edition.galleryUrl,
        archivedSiteUrl: edition.archivedSiteUrl,
        sponsorBrochureUrl: edition.sponsorBrochureUrl,
        sponsorHeroImageUrl: edition.sponsorHeroImageUrl,
        sponsorPageStatus: edition.sponsorPageStatus,
        sponsorTemporaryFormUrl: edition.sponsorTemporaryFormUrl,
        ticketTiersCount: edition._count.ticketTiers,
        articlesCount: edition._count.articles,
        speakersCount: edition._count.speakers,
        talksCount: edition._count.talks,
        sponsorsCount: edition._count.sponsors,
        categoriesCount: edition._count.categories,
      };
    }
  );

  // PUT /api/admin/editions/:id — update edition
  app.put<{
    Params: { id: string };
    Body: EditionBody;
  }>("/editions/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.edition.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return reply.status(404).send({ error: "Edition not found" });

    const body = request.body;

    // The directions URL lands in an href on the public /lieu page, so reject a
    // javascript:/data: scheme at the source rather than storing an XSS vector
    // (#109). Only validate a non-empty value — "" clears the field. isSafeUrl
    // is the same allowlist used for sponsor/social URLs (#223).
    if (body.venueDirectionsUrl && !isSafeUrl(body.venueDirectionsUrl)) {
      return reply.status(422).send({
        error: "invalid_url",
        message: "Le lien itinéraire doit être une URL http(s) valide.",
      });
    }
    const newStatus = body.status ?? existing.status;

    const edition = await prisma.edition.update({
      where: { id },
      data: {
        year: body.year ?? existing.year,
        startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
        endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
        status: newStatus,
        venueName: body.venueName !== undefined ? (body.venueName || null) : existing.venueName,
        venueAddress: body.venueAddress !== undefined ? (body.venueAddress || null) : existing.venueAddress,
        // #109. Coordinates are numbers: `null` explicitly clears them (an empty
        // map field), a number sets them; undefined keeps the existing value.
        venueLat: body.venueLat !== undefined ? body.venueLat : existing.venueLat,
        venueLng: body.venueLng !== undefined ? body.venueLng : existing.venueLng,
        // Rich-text HTML, sanitized on write like sponsor descriptions.
        venueTransports: body.venueTransports !== undefined ? (sanitizeRichHtml(body.venueTransports) || null) : existing.venueTransports,
        venueParking: body.venueParking !== undefined ? (sanitizeRichHtml(body.venueParking) || null) : existing.venueParking,
        venueDirectionsUrl: body.venueDirectionsUrl !== undefined ? (body.venueDirectionsUrl || null) : existing.venueDirectionsUrl,
        heroImageUrl: body.heroImageUrl !== undefined ? (body.heroImageUrl || null) : existing.heroImageUrl,
        sponsorFormUrl: body.sponsorFormUrl !== undefined ? (body.sponsorFormUrl || null) : existing.sponsorFormUrl,
        aftermovieUrl: body.aftermovieUrl !== undefined ? (body.aftermovieUrl || null) : existing.aftermovieUrl,
        galleryUrl: body.galleryUrl !== undefined ? (body.galleryUrl || null) : existing.galleryUrl,
        archivedSiteUrl: body.archivedSiteUrl !== undefined ? (body.archivedSiteUrl || null) : existing.archivedSiteUrl,
        sponsorBrochureUrl: body.sponsorBrochureUrl !== undefined ? (body.sponsorBrochureUrl || null) : existing.sponsorBrochureUrl,
        sponsorHeroImageUrl: body.sponsorHeroImageUrl !== undefined ? (body.sponsorHeroImageUrl || null) : existing.sponsorHeroImageUrl,
        sponsorPageStatus: body.sponsorPageStatus ?? existing.sponsorPageStatus,
        sponsorTemporaryFormUrl: body.sponsorTemporaryFormUrl !== undefined ? (body.sponsorTemporaryFormUrl || null) : existing.sponsorTemporaryFormUrl,
      },
    });

    // Revalidate the edition bilan page (both years if year changed) + home
    revalidateEdition(edition.year);
    if (existing.year !== edition.year) revalidateEdition(existing.year);
    // Sponsor page depends on featured edition fields (status, brochure, etc.)
    revalidateSponsors();

    return {
      id: edition.id,
      year: edition.year,
      status: edition.status,
    };
  });

  // POST /api/admin/editions — create edition
  app.post<{ Body: EditionBody }>("/editions", async (request, reply) => {
    const body = request.body;

    if (!body.year) return reply.status(400).send({ error: "year is required" });

    // Deliberately NOT filtered on deletedAt: `year` is unique database-wide and
    // a trashed edition still owns it. Filtering here would let the create pass
    // validation only to fail on the constraint — a 409 explains it better.
    const existing = await prisma.edition.findUnique({ where: { year: body.year } });
    if (existing) return reply.status(409).send({ error: "Edition for this year already exists" });

    const edition = await prisma.edition.create({
      data: {
        year: body.year,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status || "PREPARATION",
        venueName: body.venueName || null,
        venueAddress: body.venueAddress || null,
        heroImageUrl: body.heroImageUrl || null,
        sponsorFormUrl: body.sponsorFormUrl || null,
        aftermovieUrl: body.aftermovieUrl || null,
        galleryUrl: body.galleryUrl || null,
        archivedSiteUrl: body.archivedSiteUrl || null,
      },
    });

    return reply.status(201).send({ id: edition.id, year: edition.year });
  });

  // DELETE /api/admin/editions/:id — delete edition (cascade deletes key figures + ticket tiers)
  app.delete<{ Params: { id: string } }>(
    "/editions/:id",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

      // findFirst: findUnique cannot carry the deletedAt filter (#147).
      // Counts exclude trashed children — an edition whose talks are all in the
      // trash is genuinely empty and should be removable.
      const existing = await prisma.edition.findFirst({
        where: { id, ...notDeleted },
        include: {
          _count: {
            select: {
              articles: { where: notDeleted },
              talks: { where: notDeleted },
              speakers: { where: notDeleted },
              sponsors: { where: notDeleted },
              // `categories` is the EditionCategory join since #338: the join
              // row carries no deletedAt, so the filter targets the track.
              categories: { where: { category: notDeleted } },
              ticketTiers: { where: notDeleted },
            },
          },
        },
      });

      if (!existing) return reply.status(404).send({ error: "Edition not found" });

      // Trashing a parent refuses rather than cascading (#147). A logical
      // cascade would force restore to tell rows trashed *before* from rows
      // trashed *by* the cascade — otherwise it resurrects what should stay
      // gone. The article check below already worked this way; the other
      // children now follow the same rule.
      const blocking = Object.entries(existing._count)
        .filter(([, count]) => count > 0)
        .map(([relation, count]) => `${relation} (${count})`);

      if (blocking.length > 0) {
        return reply.status(409).send({
          error: `Cannot delete edition with linked records: ${blocking.join(", ")}`,
        });
      }

      // Year is unique but numeric — no string parking possible, so a trashed
      // edition keeps its year until purged. Creating that year again is
      // blocked meanwhile; the trash has to be emptied first.
      await prisma.edition.update({ where: { id }, data: softDeleteData() });
      revalidateEdition(existing.year);
      return { success: true };
    }
  );

  // --- Key Figures per Edition ---

  // GET /api/admin/editions/:id/key-figures
  app.get<{ Params: { id: string } }>(
    "/editions/:id/key-figures",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

      const figures = await prisma.keyFigure.findMany({
        where: { editionId: id },
        orderBy: { sortOrder: "asc" },
      });

      return figures.map((f: (typeof figures)[number]) => ({
        id: f.id,
        icon: f.icon,
        value: f.value,
        labelFr: f.labelFr,
        labelEn: f.labelEn,
        sortOrder: f.sortOrder,
      }));
    }
  );

  // PUT /api/admin/editions/:id/key-figures — replace all key figures for an edition
  app.put<{
    Params: { id: string };
    Body: { icon: string; value: string; labelFr: string; labelEn: string }[];
  }>("/editions/:id/key-figures", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const edition = await prisma.edition.findFirst({ where: { id, ...notDeleted } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const figures = request.body;

    // Reject unknown icon keys before touching anything (#164): the site
    // renders nothing for them, silently. Validating up front also means a bad
    // payload never wipes the existing figures via the deleteMany below.
    const invalid = figures.map((fig) => fig.icon).filter((icon) => !isValidStatIcon(icon));
    if (invalid.length) {
      return reply.status(400).send({
        error: `Icône inconnue : ${[...new Set(invalid)].join(", ")}`,
        allowed: STAT_ICON_KEYS,
      });
    }

    await prisma.keyFigure.deleteMany({ where: { editionId: id } });
    await prisma.keyFigure.createMany({
      data: figures.map((fig, i) => ({
        icon: fig.icon,
        value: fig.value,
        labelFr: fig.labelFr,
        labelEn: fig.labelEn,
        sortOrder: i,
        editionId: id,
      })),
    });

    revalidateEdition(edition.year);
    return { success: true, count: figures.length };
  });

  // --- Sponsor tiers offered by an edition (#318) ---
  // Which catalogue tiers this edition proposes, with a per-edition price
  // override, visibility and display order. Pure join rows (no soft delete).

  // GET /api/admin/editions/:id/sponsor-tiers — the edition's tier bindings,
  // joined to the catalogue. Trashed tiers are defended against here too.
  app.get<{ Params: { id: string } }>("/editions/:id/sponsor-tiers", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const links = await prisma.editionSponsorTier.findMany({
      where: { editionId: id },
      include: {
        tier: { select: { id: true, key: true, nameFr: true, nameEn: true, color: true, standSize: true, rank: true, deletedAt: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return links
      .filter((l) => l.tier.deletedAt === null)
      .map((l) => {
        const { deletedAt: _deletedAt, ...tier } = l.tier;
        return { id: l.id, tierId: l.tierId, isVisible: l.isVisible, price: l.price, sortOrder: l.sortOrder, tier };
      });
  });

  // PUT /api/admin/editions/:id/sponsor-tiers/:tierId — offer a tier for this
  // edition (upsert). Creating the row means "proposed"; the body tunes it.
  app.put<{
    Params: { id: string; tierId: string };
    Body: { isVisible?: boolean; price?: string | null; sortOrder?: number };
  }>("/editions/:id/sponsor-tiers/:tierId", async (request, reply) => {
    const editionId = Number(request.params.id);
    const tierId = Number(request.params.tierId);
    if (isNaN(editionId) || isNaN(tierId)) return reply.status(400).send({ error: "Invalid ID" });

    const edition = await prisma.edition.findFirst({ where: { id: editionId, ...notDeleted }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });
    const tier = await prisma.sponsorTier.findFirst({ where: { id: tierId, ...notDeleted }, select: { id: true } });
    if (!tier) return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });

    const body = request.body;
    const link = await prisma.editionSponsorTier.upsert({
      where: { editionId_tierId: { editionId, tierId } },
      update: {
        ...(body.isVisible !== undefined && { isVisible: body.isVisible }),
        ...(body.price !== undefined && { price: body.price || null }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
      create: {
        editionId,
        tierId,
        isVisible: body.isVisible ?? true,
        price: body.price || null,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    revalidateSponsors();
    return { id: link.id, tierId: link.tierId, isVisible: link.isVisible, price: link.price, sortOrder: link.sortOrder };
  });

  // DELETE /api/admin/editions/:id/sponsor-tiers/:tierId — stop offering a tier
  // for this edition. Hard delete of the join row; idempotent.
  app.delete<{ Params: { id: string; tierId: string } }>("/editions/:id/sponsor-tiers/:tierId", async (request, reply) => {
    const editionId = Number(request.params.id);
    const tierId = Number(request.params.tierId);
    if (isNaN(editionId) || isNaN(tierId)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.editionSponsorTier.deleteMany({ where: { editionId, tierId } });
    revalidateSponsors();
    return reply.code(204).send();
  });

  // --- Featured Edition ---

  // PUT /api/admin/editions/featured — set the featured edition
  app.put<{ Body: { editionId: number } }>(
    "/editions/featured",
    async (request, reply) => {
      const { editionId } = request.body;

      const edition = await prisma.edition.findFirst({ where: { id: editionId, ...notDeleted } });
      if (!edition) return reply.status(404).send({ error: "Edition not found" });

      await prisma.siteSetting.upsert({
        where: { key: "featured_edition_id" },
        update: { value: String(editionId) },
        create: { key: "featured_edition_id", value: String(editionId) },
      });

      revalidateHome();
      return { success: true, editionId };
    }
  );
}
