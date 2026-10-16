import type { FastifyInstance } from "fastify";
import { revalidateAll, revalidatePaths } from "../../lib/revalidate.js";

export default async function adminCacheRoutes(app: FastifyInstance) {
  // POST /api/admin/cache/purge — purge frontend cache for given paths, or the
  // whole site with `all: true` (#627). The "purge everything" button used to
  // send seven French pages and not a single speaker's or talk's.
  app.post<{
    Body: { paths?: string[]; all?: boolean };
  }>("/cache/purge", async (request, reply) => {
    if (request.body?.all === true) {
      const purge = await revalidateAll();
      if (!purge.ok) return reply.code(502).send({ error: "purge_failed", message: `Le cache n'a pas pu être vidé : ${purge.reason}.` });
      return { revalidated: true, all: true };
    }
    const paths = request.body?.paths || ["/"];
    await revalidatePaths(paths);
    // `revalidated` is what the admin UI checks, and it matches the frontend's
    // own /api/revalidate contract. Returning `success` instead made a purge
    // that had actually worked show up as an error (#181).
    return { revalidated: true, paths };
  });
}
