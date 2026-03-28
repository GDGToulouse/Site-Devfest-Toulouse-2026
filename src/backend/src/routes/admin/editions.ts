import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

interface EditionBody {
  year: number;
  startDate?: string;
  endDate?: string;
  status?: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  aftermovieUrl?: string;
  galleryUrl?: string;
  archivedSiteUrl?: string;
}

export default async function adminEditionRoutes(app: FastifyInstance) {
  // GET /api/admin/editions — list all editions
  app.get("/editions", async () => {
    const editions = await prisma.edition.findMany({
      orderBy: { year: "desc" },
      include: { _count: { select: { ticketTiers: true, articles: true } } },
    });

    return editions.map((e) => ({
      id: e.id,
      year: e.year,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
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
      orderBy: { year: "desc" },
    });

    if (!edition) return reply.status(404).send({ error: "No edition found" });

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      aftermovieUrl: edition.aftermovieUrl,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
    };
  });

  // PUT /api/admin/editions/:id — update edition
  app.put<{
    Params: { id: string };
    Body: EditionBody;
  }>("/editions/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.edition.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Edition not found" });

    const body = request.body;

    const edition = await prisma.edition.update({
      where: { id },
      data: {
        year: body.year ?? existing.year,
        startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
        endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
        status: body.status ?? existing.status,
        aftermovieUrl: body.aftermovieUrl !== undefined ? (body.aftermovieUrl || null) : existing.aftermovieUrl,
        galleryUrl: body.galleryUrl !== undefined ? (body.galleryUrl || null) : existing.galleryUrl,
        archivedSiteUrl: body.archivedSiteUrl !== undefined ? (body.archivedSiteUrl || null) : existing.archivedSiteUrl,
      },
    });

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

    const existing = await prisma.edition.findUnique({ where: { year: body.year } });
    if (existing) return reply.status(409).send({ error: "Edition for this year already exists" });

    const edition = await prisma.edition.create({
      data: {
        year: body.year,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status || "PREPARATION",
        aftermovieUrl: body.aftermovieUrl || null,
        galleryUrl: body.galleryUrl || null,
        archivedSiteUrl: body.archivedSiteUrl || null,
      },
    });

    return reply.status(201).send({ id: edition.id, year: edition.year });
  });
}
