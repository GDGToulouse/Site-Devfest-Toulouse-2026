import type { FastifyInstance } from "fastify";

import type { AuditChannel, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

// The history of every write (#513). ADMIN only, registered in the ADMIN group:
// it holds personal data — who edited what, from which address.

const CHANNELS: AuditChannel[] = ["ADMIN", "SPONSOR", "EDIT_LINK", "IMPORT", "API_KEY", "MCP", "PUBLIC", "SYSTEM", "AUTH"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// The field that names a record in the list, for the entities people look up.
// Read live, so a renamed speaker shows its current name; a deleted record has
// none and the screen falls back to its id.
const LABEL_FIELDS: Record<string, string> = {
  Speaker: "name",
  Talk: "title",
  Sponsor: "name",
  Article: "titleFr",
  ContentPage: "titleFr",
  Category: "nameFr",
  Edition: "year",
  User: "email",
  SponsorContact: "email",
  SponsorTier: "nameFr",
  TicketTier: "nameFr",
  SiteSetting: "key",
};

interface AuditQuery {
  entity?: string;
  entityId?: string;
  actorUserId?: string;
  channel?: AuditChannel;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

type LabelDelegate = { findMany(args: unknown): Promise<Array<Record<string, unknown>>> };

async function resolveLabels(rows: Array<{ entity: string; entityId: string }>): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const idsByEntity = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!LABEL_FIELDS[row.entity]) continue;
    if (!idsByEntity.has(row.entity)) idsByEntity.set(row.entity, new Set());
    idsByEntity.get(row.entity)!.add(row.entityId);
  }

  await Promise.all(
    [...idsByEntity].map(async ([entity, ids]) => {
      const field = LABEL_FIELDS[entity];
      const delegate = (prisma as unknown as Record<string, LabelDelegate>)[
        entity.charAt(0).toLowerCase() + entity.slice(1)
      ];
      // Users have cuid ids; every other labelled model is keyed by an int.
      const typedIds = entity === "User" ? [...ids] : [...ids].map(Number).filter(Number.isInteger);
      const records = await delegate.findMany({
        where: { id: { in: typedIds } },
        select: { id: true, [field]: true },
      });
      for (const record of records) labels.set(`${entity}:${record.id}`, String(record[field]));
    }),
  );
  return labels;
}

export default async function adminAuditRoutes(app: FastifyInstance) {
  // GET /api/admin/audit — newest first, keyset-paginated: the table only grows,
  // and an offset would shift under the reader as new lines arrive.
  app.get<{ Querystring: AuditQuery }>("/audit", {
    schema: {
      tags: ["admin-audit"],
      summary: "Historique des modifications (ADMIN)",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          entity: { type: "string", maxLength: 64 },
          entityId: { type: "string", maxLength: 64 },
          actorUserId: { type: "string", maxLength: 64 },
          channel: { type: "string", enum: CHANNELS },
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
          before: { type: "string", pattern: "^[0-9]{1,19}$" },
          limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
        },
      },
      response: {
        200: {
          type: "object",
          required: ["items", "nextCursor"],
          properties: {
            nextCursor: { type: ["string", "null"] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  action: { type: "string" },
                  entity: { type: "string" },
                  entityId: { type: "string" },
                  entityLabel: { type: ["string", "null"] },
                  channel: { type: "string" },
                  actorUserId: { type: ["string", "null"] },
                  actorLabel: { type: "string" },
                  apiKeyId: { type: ["string", "null"] },
                  ip: { type: ["string", "null"] },
                  changes: { type: ["object", "null"], additionalProperties: true },
                },
              },
            },
          },
        },
        403: { $ref: "Error#" },
      },
    },
  }, async (request) => {
    const { entity, entityId, actorUserId, channel, from, to, before } = request.query;
    const limit = request.query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.AuditLogWhereInput = {
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(actorUserId && { actorUserId }),
      ...(channel && { channel }),
      ...((from || to) && {
        createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
      }),
      ...(before && { id: { lt: BigInt(before) } }),
    };

    // One more than the page: its presence is what says there is a next page,
    // without a count over a table that only grows.
    const rows = await prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, take: limit + 1 });
    const page = rows.slice(0, limit);
    const labels = await resolveLabels(page);

    return {
      nextCursor: rows.length > limit ? page[page.length - 1].id.toString() : null,
      items: page.map((row) => ({
        ...row,
        id: row.id.toString(),
        createdAt: row.createdAt.toISOString(),
        entityLabel: labels.get(`${row.entity}:${row.entityId}`) ?? null,
      })),
    };
  });
}
