import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../lib/admin-guard.js";
import adminAuthRoutes from "./auth.js";

export default async function adminRoutes(app: FastifyInstance) {
  // Auth check route (does its own auth check internally)
  await app.register(adminAuthRoutes);

  // All subsequent admin routes require authentication
  app.addHook("preHandler", requireAdmin);
}
