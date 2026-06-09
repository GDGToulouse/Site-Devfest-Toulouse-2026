import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers, revalidateConferences } from "../../lib/revalidate.js";
import { importSessionize, loadSessionizeData } from "../../lib/sessionize-import.js";

interface SessionizeImportBody {
  editionId: number;
  url?: string;
  json?: string;
}

export default async function adminImportRoutes(app: FastifyInstance) {
  // POST /api/admin/import/sessionize — bulk import speakers + sessions from a
  // Sessionize "All data" export (US-240/US-241, RG-217). Idempotent: matches
  // by slug, so re-running updates instead of duplicating. Accepts either a
  // pasted JSON string or a Sessionize API URL fetched server-side.
  app.post<{ Body: SessionizeImportBody }>("/import/sessionize", async (request, reply) => {
    const { editionId, url, json } = request.body;
    if (!editionId) return reply.code(400).send({ error: "editionId required" });
    if (!url?.trim() && !json?.trim()) {
      return reply.code(400).send({ error: "Provide either `url` or `json`" });
    }

    const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) return reply.code(404).send({ error: "Edition not found" });

    let data;
    try {
      data = await loadSessionizeData({ url, json });
    } catch (err) {
      return reply.code(422).send({ error: "Invalid Sessionize data", detail: (err as Error).message });
    }

    const report = await importSessionize(editionId, data);

    revalidateSpeakers();
    revalidateConferences();
    return report;
  });
}
