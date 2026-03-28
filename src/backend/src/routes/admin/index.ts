import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../lib/admin-guard.js";
import adminAuthRoutes from "./auth.js";
import adminCacheRoutes from "./cache.js";
import adminArticleRoutes from "./articles.js";
import adminEditionRoutes from "./editions.js";
import adminTicketRoutes from "./tickets.js";
import adminSettingsRoutes from "./settings.js";
import adminPageRoutes from "./pages.js";
import adminContactRoutes from "./contact.js";

export default async function adminRoutes(app: FastifyInstance) {
  // Auth check route (does its own auth check internally)
  await app.register(adminAuthRoutes);

  // All subsequent admin routes require authentication
  app.addHook("preHandler", requireAdmin);

  await app.register(adminCacheRoutes);
  await app.register(adminArticleRoutes);
  await app.register(adminEditionRoutes);
  await app.register(adminTicketRoutes);
  await app.register(adminSettingsRoutes);
  await app.register(adminPageRoutes);
  await app.register(adminContactRoutes);
}
