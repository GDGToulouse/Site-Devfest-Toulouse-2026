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
import adminSponsorRoutes from "./sponsors.js";
import adminSpeakerRoutes from "./speakers.js";
import adminCategoryRoutes from "./categories.js";
import adminTalkRoutes from "./talks.js";
import adminImportRoutes from "./import.js";
import adminApiKeyRoutes from "./api-keys.js";
import adminTranslateRoutes from "./translate.js";
import adminTrashRoutes from "./trash.js";

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
    await editorApp.register(adminTranslateRoutes);
    await editorApp.register(adminSponsorRoutes);
    await editorApp.register(adminSpeakerRoutes);
    await editorApp.register(adminCategoryRoutes);
    await editorApp.register(adminTalkRoutes);
    await editorApp.register(adminImportRoutes);
    // Editors may consult and restore; the purge route carries its own
    // ADMIN-only guard, since destroying a row for good is not theirs to do.
    await editorApp.register(adminTrashRoutes);
  });

  // Routes restricted to ADMIN only
  await app.register(async (adminApp) => {
    adminApp.addHook("preHandler", requireAdminRole);
    await adminApp.register(adminCacheRoutes);
    await adminApp.register(adminEditionRoutes);
    await adminApp.register(adminTicketRoutes);
    await adminApp.register(adminSettingsRoutes);
    await adminApp.register(adminUserRoutes);
    await adminApp.register(adminApiKeyRoutes);
  });
}
