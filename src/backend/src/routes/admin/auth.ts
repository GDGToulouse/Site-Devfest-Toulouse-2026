import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";

// Helper — same rule as admin-guard: rely on user.role in DB, not on the
// ADMIN_EMAILS env var (which is only used at bootstrap).
async function getSessionWithRole(request: FastifyRequest) {
  request.log.debug({ authPhase: "adminAuth.enter", url: request.url, hasCookie: !!request.headers.cookie });
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  request.log.debug({
    authPhase: "adminAuth.session",
    session: session ? { userId: session.user.id, email: session.user.email } : null,
  });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, banned: true },
  });
  request.log.debug({ authPhase: "adminAuth.dbUser", user });
  if (!user || user.banned) {
    request.log.debug({ authPhase: "adminAuth.reject", reason: !user ? "no_user" : "banned" });
    return null;
  }
  if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    request.log.debug({ authPhase: "adminAuth.reject", reason: "bad_role", role: user.role });
    return null;
  }
  request.log.debug({ authPhase: "adminAuth.accept", role: user.role });
  return { session, role: user.role };
}

export default async function adminAuthRoutes(app: FastifyInstance) {
  // GET /api/admin/session — returns current back-office session info with role
  app.get("/session", async (request, reply) => {
    const ctx = await getSessionWithRole(request);
    if (!ctx) return reply.status(403).send({ error: "Forbidden" });

    return {
      user: {
        id: ctx.session.user.id,
        email: ctx.session.user.email,
        name: ctx.session.user.name,
        image: ctx.session.user.image,
        role: ctx.role,
      },
    };
  });

  // PUT /api/admin/profile — update current user's name
  app.put<{ Body: { name?: string } }>("/profile", async (request, reply) => {
    const ctx = await getSessionWithRole(request);
    if (!ctx) return reply.status(403).send({ error: "Forbidden" });

    const { name } = request.body;

    const updated = await prisma.user.update({
      where: { id: ctx.session.user.id },
      data: {
        ...(name !== undefined && { name: name.trim() || null }),
      },
    });

    return { id: updated.id, name: updated.name, email: updated.email };
  });
}
