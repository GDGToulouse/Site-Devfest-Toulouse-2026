import type { FastifyRequest, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { prisma } from "./prisma.js";

// Source of truth for back-office access: the user.role column in DB.
// ADMIN_EMAILS is only used at bootstrap (prisma/seed.ts) to create the very
// first admin account. After that, admins grant / revoke access through the
// back-office (Utilisateurs page) which writes to user.role.
async function getSessionUser(request: FastifyRequest) {
  request.log.debug({ authPhase: "guard.enter", url: request.url, method: request.method, hasCookie: !!request.headers.cookie });

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  request.log.debug({
    authPhase: "guard.session",
    session: session ? { userId: session.user.id, email: session.user.email } : null,
  });

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, banned: true },
  });

  request.log.debug({ authPhase: "guard.dbUser", user });

  if (!user || user.banned) {
    request.log.debug({ authPhase: "guard.reject", reason: !user ? "no_user" : "banned" });
    return null;
  }
  if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    request.log.debug({ authPhase: "guard.reject", reason: "bad_role", role: user.role });
    return null;
  }

  request.log.debug({ authPhase: "guard.accept", role: user.role });
  return {
    ...session.user,
    role: user.role,
  };
}

/** Requires any authenticated back-office user (ADMIN or EDITOR) */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) {
    request.log.debug({ authPhase: "requireAdmin.deny" });
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
  (request as FastifyRequest & { adminUser?: typeof user }).adminUser = user;
}

/** Requires ADMIN role specifically (not EDITOR) */
export async function requireAdminRole(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    request.log.debug({ authPhase: "requireAdminRole.deny", role: user?.role ?? null });
    reply.status(403).send({ error: "Forbidden — admin only" });
    return;
  }
  (request as FastifyRequest & { adminUser?: typeof user }).adminUser = user;
}
