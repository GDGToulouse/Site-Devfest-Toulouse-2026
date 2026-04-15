import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "./auth.js";
import { prisma } from "./prisma.js";

// Source of truth for back-office access: the user.role column in DB.
// ADMIN_EMAILS is only used at bootstrap (prisma/seed.ts) to create the very
// first admin account. After that, admins grant / revoke access through the
// back-office (Utilisateurs page) which writes to user.role.
async function getSessionUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, banned: true },
  });

  if (!user || user.banned) return null;
  if (user.role !== "ADMIN" && user.role !== "EDITOR") return null;

  return {
    ...session.user,
    role: user.role,
  };
}

/** Requires any authenticated back-office user (ADMIN or EDITOR) */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) {
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
  (request as FastifyRequest & { adminUser?: typeof user }).adminUser = user;
}

/** Requires ADMIN role specifically (not EDITOR) */
export async function requireAdminRole(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    reply.status(403).send({ error: "Forbidden — admin only" });
    return;
  }
  (request as FastifyRequest & { adminUser?: typeof user }).adminUser = user;
}
