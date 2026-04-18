import type { FastifyInstance } from "fastify";
import { requireAdmin, requireAdminRole } from "../../lib/admin-guard.js";
import adminAuthRoutes from "./auth.js";
import adminCacheRoutes from "./cache.js";
import adminArticleRoutes from "./articles.js";
import adminEditionRoutes from "./editions.js";
import adminTicketRoutes from "./tickets.js";
import adminSettingsRoutes from "./settings.js";
import adminPageRoutes from "./pages.js";
import adminContactRoutes from "./contact.js";
import adminFileRoutes from "./files.js";
import adminUserRoutes from "./users.js";
import adminSponsorPlanRoutes from "./sponsor-plans.js";
import adminApiKeyRoutes from "./api-keys.js";

export default async function adminRoutes(app: FastifyInstance) {
  // Auth check route (does its own auth check internally)
  await app.register(adminAuthRoutes);

  // Routes accessible to ADMIN + EDITOR
  await app.register(async (editorApp) => {
    editorApp.addHook("preHandler", requireAdmin);
    await editorApp.register(adminArticleRoutes);
    await editorApp.register(adminPageRoutes);
    await editorApp.register(adminContactRoutes);
    await editorApp.register(adminFileRoutes);
  });

  // Routes restricted to ADMIN only
  await app.register(async (adminApp) => {
    adminApp.addHook("preHandler", requireAdminRole);
    await adminApp.register(adminCacheRoutes);
    await adminApp.register(adminEditionRoutes);
    await adminApp.register(adminTicketRoutes);
    await adminApp.register(adminSettingsRoutes);
    await adminApp.register(adminUserRoutes);
    await adminApp.register(adminSponsorPlanRoutes);
    await adminApp.register(adminApiKeyRoutes);
  });
}
