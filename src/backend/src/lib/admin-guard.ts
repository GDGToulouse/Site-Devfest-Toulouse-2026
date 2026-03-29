import type { FastifyRequest, FastifyReply } from "fastify";
import { auth, isAdminEmail } from "./auth.js";
import { prisma } from "./prisma.js";

async function getSessionUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!session || !isAdminEmail(session.user.email)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  return {
    ...session.user,
    role: user?.role || "ADMIN",
  };
}

/** Requires any authenticated admin (ADMIN or EDITOR) */
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
