import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
});

await app.register(helmet);

app.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
