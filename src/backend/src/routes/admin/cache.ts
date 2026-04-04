import type { FastifyInstance } from "fastify";
import { revalidatePaths } from "../../lib/revalidate.js";

export default async function adminCacheRoutes(app: FastifyInstance) {
  // POST /api/admin/cache/purge — purge frontend cache for given paths
  app.post<{
    Body: { paths?: string[] };
  }>("/cache/purge", async (request) => {
    const paths = request.body?.paths || ["/"];
    await revalidatePaths(paths);
    return { success: true, paths };
  });
}
