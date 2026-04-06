import type { FastifyInstance } from "fastify";
import { auth, isAdminEmail } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";

export default async function adminAuthRoutes(app: FastifyInstance) {
  // GET /api/admin/session — returns current admin session info with role
  app.get("/session", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session || !isAdminEmail(session.user.email)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: user?.role || "ADMIN",
      },
    };
  });
}
