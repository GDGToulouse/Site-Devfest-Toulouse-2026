import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";

import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
import {
  deriveStationToken,
  encodeStation,
  listStations,
  stationName,
  stationWindow,
} from "../../lib/arrivals-station.js";

// The station links (RG-ARR-70 to RG-ARR-76, #775), managed by an admin: the
// window in which the QR codes open their station, the sheets to print, and the
// regeneration that retires every printed code and the sessions they opened.

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

const EDITION_SELECT = {
  id: true,
  year: true,
  startDate: true,
  endDate: true,
  stationAccessFrom: true,
  stationAccessUntil: true,
  stationAccessGeneration: true,
  badgeCounters: true,
  badgeBinsPerCounter: true,
} as const;

async function findEdition(editionId: number) {
  return prisma.edition.findFirst({ where: { id: editionId, ...notDeleted }, select: EDITION_SELECT });
}

type StationEdition = NonNullable<Awaited<ReturnType<typeof findEdition>>>;

async function describe(edition: StationEdition) {
  const effective = stationWindow(edition);
  const stations = await Promise.all(
    listStations({ counters: edition.badgeCounters, binsPerCounter: edition.badgeBinsPerCounter }).map(
      async (station) => {
        const url = `${baseUrl}/arrivees/poste/${deriveStationToken(edition.id, station, edition.stationAccessGeneration)}`;
        return {
          code: encodeStation(station),
          kind: station.kind,
          counter: station.kind === "counter" ? station.counter : null,
          bin: station.kind === "counter" ? station.bin : null,
          name: stationName(station),
          url,
          // Vector, drawn by the same library as the badges' QR codes.
          qrSvg: await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0 }),
        };
      },
    ),
  );
  return {
    year: edition.year,
    generation: edition.stationAccessGeneration,
    // What the admin set; null = the default, shown beside it as `effective`.
    window: { from: edition.stationAccessFrom, until: edition.stationAccessUntil },
    effective,
    stations,
  };
}

export default async function adminArrivalsStationRoutes(app: FastifyInstance) {
  // GET /api/admin/arrivals-stations/:editionId — the window and every
  // station's link and QR code. The links are derived from the server's secret
  // and the generation, so they can be shown again at any time (RG-ARR-73).
  app.get<{ Params: { editionId: string } }>(
    "/arrivals-stations/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      return describe(edition);
    },
  );

  // PUT /api/admin/arrivals-stations/:editionId/window — null on a side puts
  // the default back (RG-ARR-71).
  app.put<{ Params: { editionId: string }; Body: { from: string | null; until: string | null } }>(
    "/arrivals-stations/:editionId/window",
    {
      schema: {
        params: editionIdParams,
        body: {
          type: "object",
          required: ["from", "until"],
          additionalProperties: false,
          properties: {
            from: { type: ["string", "null"], format: "date-time" },
            until: { type: ["string", "null"], format: "date-time" },
          },
        },
      },
    },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      const from = request.body.from ? new Date(request.body.from) : null;
      const until = request.body.until ? new Date(request.body.until) : null;

      const effective = stationWindow({ ...edition, stationAccessFrom: from, stationAccessUntil: until });
      if (effective.from && effective.until && effective.from >= effective.until) {
        return reply.code(400).send({ error: "invalid_window", message: "La fin doit être après le début." });
      }
      const updated = await prisma.edition.update({
        where: { id: edition.id },
        data: { stationAccessFrom: from, stationAccessUntil: until },
        select: EDITION_SELECT,
      });
      return describe(updated);
    },
  );

  // POST /api/admin/arrivals-stations/:editionId/regenerate — every printed
  // code and every session they opened stop working (RG-ARR-75).
  app.post<{ Params: { editionId: string } }>(
    "/arrivals-stations/:editionId/regenerate",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      const updated = await prisma.edition.update({
        where: { id: edition.id },
        data: { stationAccessGeneration: { increment: 1 } },
        select: EDITION_SELECT,
      });
      return describe(updated);
    },
  );
}
