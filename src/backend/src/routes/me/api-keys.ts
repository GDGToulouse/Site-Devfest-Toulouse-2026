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

/**
 * Why a key cannot be rotated, or null when it can (#227). A dead key is never
 * resurrected: rotating a revoked one would silently un-revoke it, and rotating
 * an expired one would hand back a secret that still cannot authenticate. In
 * both cases the answer is to create a fresh key.
 */
export function rotationBlockedReason(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date(),
): "key_revoked" | "key_expired" | null {
  if (key.revokedAt) return "key_revoked";
  if (key.expiresAt && key.expiresAt <= now) return "key_expired";
  return null;
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

  // POST /api/me/api-keys/:id/rotate — replace the secret of an existing key.
  //
  // A key is only ever shown once, and it is stored hashed, so a mislaid key
  // used to leave no option but "create a new one, then revoke the old one by
  // hand" (#227). Rotating keeps the same row — same name, same expiry, same
  // creation date — and only swaps its value.
  //
  // The old value stops working immediately: a mislaid key is a potentially
  // compromised key, and it must not outlive its rotation. Both `prefix` and
  // `hashedKey` are replaced in the same update — the prefix is what
  // authentication looks the key up by (auth-context.ts), so leaving it behind
  // would keep the old secret alive.
  app.post<{ Params: { id: string } }>("/api-keys/:id/rotate", {
    schema: {
      tags: ["api-keys"],
      summary: "Faire tourner un de ses propres jetons (nouvelle valeur, ancienne révoquée)",
      description:
        "Remplace la valeur du jeton en conservant son nom et son expiration. L'ancienne valeur cesse de fonctionner immédiatement. La nouvelle valeur (`key`) n'est retournée qu'une seule fois.",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      response: {
        200: { $ref: "CreatedApiKey#" },
        400: { $ref: "Error#" },
        401: { $ref: "Error#" },
        403: { $ref: "Error#" },
        404: { $ref: "Error#" },
      },
    },
  }, async (request, reply) => {
    const user = getCurrentUser(request);
    const key = await prisma.apiKey.findUnique({ where: { id: request.params.id } });
    // Same 404-on-someone-else's-key as DELETE: never confirm a key exists.
    if (!key || key.userId !== user.id) {
      return reply.status(404).send({ error: "not_found" });
    }

    const blocked = rotationBlockedReason(key);
    if (blocked) {
      return reply.status(400).send({ error: blocked });
    }

    const { raw, prefix, hashedKey } = await generateApiKey(resolveApiKeyEnv());

    const rotated = await prisma.apiKey.update({
      where: { id: key.id },
      data: {
        prefix,
        hashedKey,
        // The new secret has never been used; carrying the old timestamp over
        // would misreport when this value was last seen.
        lastUsedAt: null,
      },
    });

    return {
      ...serializeApiKey(rotated),
      // Shown once, exactly like on creation.
      key: raw,
    };
  });

  // DELETE /api/me/api-keys/:id — revoke caller's own key (soft-delete).
  // With ?purge=true, physically delete an already-revoked key. We refuse
  // to hard-delete an active key: revoking first creates a paper trail
  // (the admin can tell the user "yes I revoked this one") before the row
  // disappears for good.
  app.delete<{ Params: { id: string }; Querystring: { purge?: string } }>("/api-keys/:id", {
    schema: {
      tags: ["api-keys"],
      summary: "Révoquer (ou supprimer définitivement) un de ses propres jetons",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      querystring: {
        type: "object",
        properties: {
          purge: {
            type: "string",
            enum: ["true", "false"],
            description: "`true` pour supprimer physiquement une clé déjà révoquée",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            alreadyRevoked: { type: "boolean" },
            purged: { type: "boolean" },
          },
        },
        400: { $ref: "Error#" },
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

    const wantPurge = request.query.purge === "true";
    if (wantPurge) {
      if (!key.revokedAt) {
        return reply.status(400).send({ error: "key_still_active" });
      }
      await prisma.apiKey.delete({ where: { id: key.id } });
      return { ok: true, purged: true };
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
