import type { FastifyInstance } from "fastify";
import { auth, isAdminEmail } from "../../lib/auth.js";

export default async function adminAuthRoutes(app: FastifyInstance) {
  // GET /api/admin/session — returns current admin session info
  app.get("/session", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session || !isAdminEmail(session.user.email)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    };
  });
}
