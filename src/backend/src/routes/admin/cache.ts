import type { FastifyInstance } from "fastify";
import { revalidatePaths } from "../../lib/revalidate.js";

export default async function adminCacheRoutes(app: FastifyInstance) {
  // POST /api/admin/cache/purge — purge frontend cache for given paths
  app.post<{
    Body: { paths?: string[] };
  }>("/cache/purge", async (request) => {
    const paths = request.body?.paths || ["/"];
    await revalidatePaths(paths);
    // `revalidated` is what the admin UI checks, and it matches the frontend's
    // own /api/revalidate contract. Returning `success` instead made a purge
    // that had actually worked show up as an error (#181).
    return { revalidated: true, paths };
  });
}
