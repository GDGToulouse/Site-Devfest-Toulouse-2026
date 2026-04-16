import type { FastifyRequest, FastifyReply } from "fastify";

import { getAuthContext, type AuthContext } from "./auth-context.js";

// Source of truth for back-office access: the user.role column in DB.
// ADMIN_EMAILS is only used at bootstrap (prisma/seed.ts) to create the very
// first admin account. After that, admins grant / revoke access through the
// back-office (Utilisateurs page) which writes to user.role.
//
// Auth can come from either a Better Auth session cookie (browser back-office)
// or an API key sent as `Authorization: Bearer <token>` (external clients).
// `getAuthContext` handles both paths and returns the resolved user + source.

/** Requires any authenticated back-office user (ADMIN or EDITOR) */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    request.log.debug({ authPhase: "requireAdmin.deny" });
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
  if (ctx.user.role !== "ADMIN" && ctx.user.role !== "EDITOR") {
    request.log.debug({ authPhase: "requireAdmin.deny", reason: "bad_role", role: ctx.user.role });
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
  (request as FastifyRequest & { adminUser?: AuthContext["user"] }).adminUser = ctx.user;
}

/** Requires ADMIN role specifically (not EDITOR) */
export async function requireAdminRole(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await getAuthContext(request);
  if (!ctx || ctx.user.role !== "ADMIN") {
    request.log.debug({ authPhase: "requireAdminRole.deny", role: ctx?.user.role ?? null });
    reply.status(403).send({ error: "Forbidden — admin only" });
    return;
  }
  (request as FastifyRequest & { adminUser?: AuthContext["user"] }).adminUser = ctx.user;
}
