import Fastify from "fastify";
import editionRoutes from "../routes/editions.js";
import articleRoutes from "../routes/articles.js";
import settingsRoutes from "../routes/settings.js";
import pageRoutes from "../routes/pages.js";
import contactRoutes from "../routes/contact.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(editionRoutes, { prefix: "/api" });
  await app.register(articleRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api" });
  await app.register(pageRoutes, { prefix: "/api" });
  await app.register(contactRoutes, { prefix: "/api" });

  return app;
}
