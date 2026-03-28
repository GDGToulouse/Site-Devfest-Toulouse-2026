import type { FastifyRequest, FastifyReply } from "fastify";
import { auth, isAdminEmail } from "./auth.js";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!session || !isAdminEmail(session.user.email)) {
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
}
