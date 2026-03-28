import type { FastifyInstance } from "fastify";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "dev-secret";

export default async function adminCacheRoutes(app: FastifyInstance) {
  // POST /api/admin/cache/purge — purge frontend cache for given paths
  app.post<{
    Body: { paths?: string[] };
  }>("/cache/purge", async (request, reply) => {
    const paths = request.body?.paths || ["/"];

    try {
      const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: REVALIDATE_SECRET, paths }),
      });

      if (!res.ok) {
        const text = await res.text();
        return reply.status(502).send({ error: "Revalidation failed", detail: text });
      }

      const data = await res.json();
      return { success: true, ...data };
    } catch (err) {
      app.log.error("Cache purge failed: %s", String(err));
      return reply.status(502).send({ error: "Failed to contact frontend" });
    }
  });
}
