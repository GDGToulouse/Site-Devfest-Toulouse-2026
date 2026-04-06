// Set env vars needed by Better Auth before any imports
process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import Fastify from "fastify";
import adminArticleRoutes from "../routes/admin/articles.js";
import adminEditionRoutes from "../routes/admin/editions.js";
import adminTicketRoutes from "../routes/admin/tickets.js";
import adminSettingsRoutes from "../routes/admin/settings.js";
import adminPageRoutes from "../routes/admin/pages.js";
import adminContactRoutes from "../routes/admin/contact.js";

export async function buildAdminApp() {
  const app = Fastify({ logger: false });

  // Register admin routes WITHOUT auth middleware (for testing)
  await app.register(adminArticleRoutes, { prefix: "/api/admin" });
  await app.register(adminEditionRoutes, { prefix: "/api/admin" });
  await app.register(adminTicketRoutes, { prefix: "/api/admin" });
  await app.register(adminSettingsRoutes, { prefix: "/api/admin" });
  await app.register(adminPageRoutes, { prefix: "/api/admin" });
  await app.register(adminContactRoutes, { prefix: "/api/admin" });

  return app;
}
