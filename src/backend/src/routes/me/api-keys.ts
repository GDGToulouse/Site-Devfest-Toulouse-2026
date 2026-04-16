import type { FastifyInstance, FastifyRequest } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { requireAnyAuthenticated } from "../../lib/auth-context.js";
import { generateApiKey, resolveApiKeyEnv } from "../../lib/api-key.js";

// Soft cap on active keys per user. Meant as a sanity safeguard, not a
// security boundary — an admin can raise/lower it in code as the usage
// pattern solidifies. Revoked keys do not count.
const MAX_ACTIVE_KEYS_PER_USER = 20;

interface CreateApiKeyBody {
  name?: string;
  expiresAt?: string | null;
}

function getCurrentUser(request: FastifyRequest) {
  const ctx = request.authContext;
  if (!ctx) throw new Error("authContext missing — requireAnyAuthenticated must run first");
  return ctx.user;
}

function serializeApiKey(k: {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

export default async function myApiKeysRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAnyAuthenticated);

  // GET /api/me/api-keys — list caller's own keys (never exposes raw/hash)
  app.get("/api-keys", {
    schema: {
      tags: ["api-keys"],
      summary: "Lister ses propres jetons d'API",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: { type: "array", items: { $ref: "ApiKey#" } },
        401: { $ref: "Error#" },
        403: { $ref: "Error#" },
      },
    },
  }, async (request) => {
    const user = getCurrentUser(request);
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    });
    return keys.map(serializeApiKey);
  });

  // POST /api/me/api-keys — create a new key. The raw value is returned ONCE.
  app.post<{ Body: CreateApiKeyBody }>("/api-keys", {
    schema: {
      tags: ["api-keys"],
      summary: "Créer un nouveau jeton d'API",
      description: "La valeur complète de la clé (`key`) n'est retournée qu'à la création. Stockez-la immédiatement.",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80, description: "Nom libre identifiant la clé" },
          expiresAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Date d'expiration ISO 8601 (optionnelle)",
          },
        },
      },
      response: {
        201: { $ref: "CreatedApiKey#" },
        400: { $ref: "Error#" },
        401: { $ref: "Error#" },
        403: { $ref: "Error#" },
      },
    },
  }, async (request, reply) => {
    const user = getCurrentUser(request);
    const { name, expiresAt } = request.body ?? {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "name_required" });
    }
    const trimmed = name.trim().slice(0, 80);

    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return reply.status(400).send({ error: "invalid_expires_at" });
      }
      if (parsed.getTime() <= Date.now()) {
        return reply.status(400).send({ error: "expires_at_in_past" });
      }
      expiresAtDate = parsed;
    }

    const activeCount = await prisma.apiKey.count({
      where: { userId: user.id, revokedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_KEYS_PER_USER) {
      return reply.status(400).send({ error: "too_many_active_keys" });
    }

    const { raw, prefix, hashedKey } = await generateApiKey(resolveApiKeyEnv());

    const created = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: trimmed,
        prefix,
        hashedKey,
        expiresAt: expiresAtDate,
      },
    });

    reply.status(201);
    return {
      ...serializeApiKey(created),
      // The raw secret. Client must store it now; the server will never
      // expose it again.
      key: raw,
    };
  });

  // DELETE /api/me/api-keys/:id — revoke caller's own key
  app.delete<{ Params: { id: string } }>("/api-keys/:id", {
    schema: {
      tags: ["api-keys"],
      summary: "Révoquer un de ses propres jetons",
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
        401: { $ref: "Error#" },
        403: { $ref: "Error#" },
        404: { $ref: "Error#" },
      },
    },
  }, async (request, reply) => {
    const user = getCurrentUser(request);
    const key = await prisma.apiKey.findUnique({ where: { id: request.params.id } });
    if (!key || key.userId !== user.id) {
      return reply.status(404).send({ error: "not_found" });
    }
    if (key.revokedAt) {
      return reply.status(200).send({ ok: true, alreadyRevoked: true });
    }
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });
}
