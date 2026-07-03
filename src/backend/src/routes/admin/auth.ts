import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { getAuthContext } from "../../lib/auth-context.js";

// /api/admin/auth — self-check for the current caller (session cookie or API key).
// Anyone with a valid back-office identity (ADMIN or EDITOR) can read it.

export default async function adminAuthRoutes(app: FastifyInstance) {
  // GET /api/admin/session — returns current back-office identity with role
  app.get("/session", async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.status(403).send({ error: "Forbidden" });
    if (ctx.user.role !== "ADMIN" && ctx.user.role !== "EDITOR") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        role: ctx.user.role,
      },
      source: ctx.source,
    };
  });

  // PUT /api/admin/profile — update current user's name
  app.put<{ Body: { name?: string } }>("/profile", async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.status(403).send({ error: "Forbidden" });
    if (ctx.user.role !== "ADMIN" && ctx.user.role !== "EDITOR") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const { name } = request.body;

    const updated = await prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        ...(name !== undefined && { name: name.trim() || null }),
      },
    });

    return { id: updated.id, name: updated.name, email: updated.email };
  });
}
