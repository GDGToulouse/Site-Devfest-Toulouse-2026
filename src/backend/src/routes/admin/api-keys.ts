import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

interface ListQuery {
  userId?: string;
  status?: "active" | "revoked" | "all";
  page?: string;
  limit?: string;
}

export default async function adminApiKeysRoutes(app: FastifyInstance) {
  // GET /api/admin/api-keys — global list with filters
  app.get<{ Querystring: ListQuery }>("/api-keys", {
    schema: {
      tags: ["admin-api-keys"],
      summary: "Vue d'ensemble admin des jetons (tous utilisateurs)",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          userId: { type: "string" },
          status: { type: "string", enum: ["active", "revoked", "all"] },
          page: { type: "string" },
          limit: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          required: ["page", "limit", "total", "items"],
          properties: {
            page: { type: "integer" },
            limit: { type: "integer" },
            total: { type: "integer" },
            items: { type: "array", items: { $ref: "ApiKeyWithUser#" } },
          },
        },
        403: { $ref: "Error#" },
      },
    },
  }, async (request) => {
    const { userId, status = "all" } = request.query;
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (status === "active") where.revokedAt = null;
    else if (status === "revoked") where.revokedAt = { not: null };

    const [total, items] = await Promise.all([
      prisma.apiKey.count({ where }),
      prisma.apiKey.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        user: k.user,
      })),
    };
  });

  // DELETE /api/admin/api-keys/:id — revoke any key
  app.delete<{ Params: { id: string } }>("/api-keys/:id", {
    schema: {
      tags: ["admin-api-keys"],
      summary: "Révoquer n'importe quelle clé (ADMIN)",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      response: {
        200: {
          type: "object",
          properties: { ok: { type: "boolean" }, alreadyRevoked: { type: "boolean" } },
        },
        403: { $ref: "Error#" },
        404: { $ref: "Error#" },
      },
    },
  }, async (request, reply) => {
    const key = await prisma.apiKey.findUnique({ where: { id: request.params.id } });
    if (!key) return reply.status(404).send({ error: "not_found" });
    if (key.revokedAt) return reply.send({ ok: true, alreadyRevoked: true });
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });
}
