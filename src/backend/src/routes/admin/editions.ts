import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateHome, revalidateEdition, revalidateSponsors } from "../../lib/revalidate.js";
import { isValidStatIcon, STAT_ICON_KEYS } from "../../lib/stat-icons.js";
import { notDeleted, softDeleteData } from "../../lib/admin-helpers.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";

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
  // SponsorLevel names offered when creating a sponsor for this edition (US-245).
  openSponsorLevels?: string[];
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
              categories: { where: notDeleted },
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
        openSponsorLevels: edition.openSponsorLevels ? JSON.parse(edition.openSponsorLevels) : [],
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
        openSponsorLevels: body.openSponsorLevels !== undefined
          ? (body.openSponsorLevels.length > 0 ? JSON.stringify(body.openSponsorLevels) : null)
          : existing.openSponsorLevels,
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
              categories: { where: notDeleted },
              sponsorPlans: { where: notDeleted },
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
