import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { auth } from "./lib/auth.js";
import editionRoutes from "./routes/editions.js";
import articleRoutes from "./routes/articles.js";
import settingsRoutes from "./routes/settings.js";
import pageRoutes from "./routes/pages.js";
import contactRoutes from "./routes/contact.js";
import adminRoutes from "./routes/admin/index.js";

const port = Number(process.env.PORT) || 4000;
// Always bind to 0.0.0.0 in Docker — Coolify injects HOST=127.0.0.1 which blocks container networking
const host = "0.0.0.0";

const app = Fastify({ logger: true });

const corsOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  process.env.BASE_URL || "http://localhost:3000",
];
await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
});

await app.register(helmet, {
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
await app.register(multipart);
await app.register(fastifyStatic, {
  root: "/app/uploads",
  prefix: "/uploads/",
  decorateReply: false,
});

// Health check
app.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Auth routes — delegate to Better Auth handler
app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, `http://${request.headers.host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) headers.append(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });

    const response = await auth.handler(req);

    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));

    const body = await response.text();
    reply.send(body || null);
  },
});

// Public API routes
await app.register(editionRoutes, { prefix: "/api" });
await app.register(articleRoutes, { prefix: "/api" });
await app.register(settingsRoutes, { prefix: "/api" });
await app.register(pageRoutes, { prefix: "/api" });
await app.register(contactRoutes, { prefix: "/api" });

// Admin routes (protected by requireAdmin hook)
await app.register(adminRoutes, { prefix: "/api/admin" });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
