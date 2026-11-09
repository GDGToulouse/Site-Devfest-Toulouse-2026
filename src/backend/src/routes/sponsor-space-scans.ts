import type { FastifyInstance, FastifyRequest } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getAuthContext } from "../lib/auth-context.js";
import { findCurrentEdition } from "../lib/arrivals-access.js";
import { requireSponsorAccess } from "../lib/sponsor-guard.js";
import { sponsorScanRateLimit } from "../lib/rate-limit-options.js";
import { listSponsorScans, recordSponsorScan, SCAN_CODE_MAX, sponsorScansCsv } from "../lib/sponsor-scans.js";

// A sponsor's booth scans the badges held out to it (#813), and finds the
// people it met in its space, with an export. Every contact of the sponsor,
// whatever its role, and an ADMIN for support. The badge's code is the only
// way to a person: no route here searches or lists the edition's attendees.

const sponsorIdParams = {
  type: "object",
  required: ["sponsorId"],
  properties: { sponsorId: { type: "string" } },
} as const;

const config = { rateLimit: sponsorScanRateLimit };

// The edition the event-day screens work on, if this sponsor takes part in it.
async function scanEdition(sponsorId: number) {
  const edition = await findCurrentEdition();
  if (!edition) return null;
  const participation = await prisma.editionSponsor.findFirst({
    where: { sponsorId, editionId: edition.id },
    select: { id: true },
  });
  return participation ? edition : null;
}

const NO_PARTICIPATION = {
  error: "no_current_participation",
  message: "Votre entreprise ne participe pas à l'édition en cours : le scan des badges n'y est pas ouvert.",
};

async function scannerLabel(request: FastifyRequest): Promise<string> {
  const ctx = await getAuthContext(request);
  const name = ctx?.user.name?.trim() || ctx?.user.email || "Inconnu";
  return request.sponsorAccess!.isAdminOverride ? `${name} (équipe DevFest)` : name;
}

export default async function sponsorSpaceScanRoutes(app: FastifyInstance) {
  // GET /api/sponsor-space/:sponsorId/scans — the booth's scans, latest first.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/scans", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
    config,
  }, async (request, reply) => {
    const { sponsorId } = request.sponsorAccess!;
    const edition = await scanEdition(sponsorId);
    if (!edition) return reply.code(422).send(NO_PARTICIPATION);
    return { year: edition.year, scans: await listSponsorScans(edition.id, sponsorId) };
  });

  // POST /api/sponsor-space/:sponsorId/scans — one badge read by the camera.
  // Whatever the code, it is kept: an unknown one is shown back as read.
  app.post<{ Params: { sponsorId: string }; Body: { code: string } }>("/sponsor-space/:sponsorId/scans", {
    schema: {
      params: sponsorIdParams,
      body: {
        type: "object",
        required: ["code"],
        additionalProperties: false,
        properties: { code: { type: "string", minLength: 1, maxLength: SCAN_CODE_MAX } },
      },
    },
    preHandler: requireSponsorAccess("STAND"),
    config,
  }, async (request, reply) => {
    const { sponsorId } = request.sponsorAccess!;
    const code = request.body.code.trim();
    if (!code) return reply.code(400).send({ error: "empty_code" });
    const edition = await scanEdition(sponsorId);
    if (!edition) return reply.code(422).send(NO_PARTICIPATION);
    const { item, isDuplicate } = await recordSponsorScan(edition.id, sponsorId, code, await scannerLabel(request));
    return reply.code(isDuplicate ? 200 : 201).send({ scan: item, isDuplicate });
  });

  // GET /api/sponsor-space/:sponsorId/scans/export — the CSV, e-mail included.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/scans/export", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
    config,
  }, async (request, reply) => {
    const { sponsorId } = request.sponsorAccess!;
    const edition = await scanEdition(sponsorId);
    if (!edition) return reply.code(422).send(NO_PARTICIPATION);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="contacts-devfest-${edition.year}.csv"`)
      .header("Cache-Control", "no-store")
      .send(await sponsorScansCsv(edition.id, sponsorId));
  });
}
