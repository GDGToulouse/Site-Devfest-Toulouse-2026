import Fastify from "fastify";
import sponsorRoutes from "../routes/sponsors.js";

// Minimal app exposing the public sponsor routes, used to assert that private
// sponsor fields (#249) never leak on the public API.
export async function buildPublicApp() {
  const app = Fastify({ logger: false });
  await app.register(sponsorRoutes, { prefix: "/api" });
  return app;
}
