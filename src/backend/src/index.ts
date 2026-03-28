import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { auth, isAdminEmail } from "./lib/auth.js";
import editionRoutes from "./routes/editions.js";
import articleRoutes from "./routes/articles.js";
import settingsRoutes from "./routes/settings.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

await app.register(helmet);

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

// Admin guard — reusable hook
export async function requireAdmin(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
  const session = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!session || !isAdminEmail(session.user.email)) {
    reply.status(403).send({ error: "Forbidden" });
    return;
  }
}

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
