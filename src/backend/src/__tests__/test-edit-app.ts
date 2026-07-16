import Fastify from "fastify";
import multipart from "@fastify/multipart";
import editRoutes from "../routes/edit.js";

// Minimal app for the token-based edit routes. The upload endpoint needs the
// multipart plugin, which the real server registers globally (index.ts).
export async function buildEditApp() {
  const app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(editRoutes, { prefix: "/api" });
  return app;
}
