import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { buildAlertPayload, sendAlert } from "./lib/alert-webhook.js";
import { startScheduledTasks } from "./lib/scheduler.js";
import { registerRequestContext } from "./lib/request-context.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerAuthRoutes } from "./plugins/auth-routes.js";
import { registerCommonSchemas } from "./schemas/common.js";
import { registerApiKeySchemas } from "./schemas/api-key.js";
import { APP_VERSION, APP_ENVIRONMENT, APP_COMMIT } from "./lib/version.js";
import editionRoutes from "./routes/editions.js";
import calendarRoutes from "./routes/calendar.js";
import articleRoutes from "./routes/articles.js";
import settingsRoutes from "./routes/settings.js";
import pageRoutes from "./routes/pages.js";
import contactRoutes from "./routes/contact.js";
import brochureRoutes from "./routes/brochure.js";
import sponsorRoutes from "./routes/sponsors.js";
import speakerRoutes from "./routes/speakers.js";
import categoryRoutes from "./routes/categories.js";
import talkRoutes from "./routes/talks.js";
import replayRoutes from "./routes/replays.js";
import editRoutes from "./routes/edit.js";
import sponsorInvitationRoutes from "./routes/sponsor-invitation.js";
import sponsorSpaceRoutes from "./routes/sponsor-space.js";
import maintenanceRoutes from "./routes/maintenance.js";
import myApiKeysRoutes from "./routes/me/api-keys.js";
import adminRoutes from "./routes/admin/index.js";
import { serverOptions } from "./lib/server-options.js";
import { rateLimitOptions, UPLOADS_PREFIX } from "./lib/rate-limit-options.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

// LOG_LEVEL: set to "debug" (or "trace") to enable verbose .debug() entries
// scattered across the codebase (auth guards, proxy, etc.). Defaults to "info"
// so debug entries are filtered out in normal runs and free to leave in place
// as a permanent diagnostic tool.
//
// The rest lives in serverOptions, shared with the test that probes the router
// (#467) — a limit only the real server carries is a limit nothing checks.
const app = Fastify({
  ...serverOptions,
  logger: { level: process.env.LOG_LEVEL || "info" },
});

// Fastify rejects `content-type: application/json` with an empty payload
// (FST_ERR_CTP_EMPTY_JSON_BODY) — yet that is exactly what a plain fetch()
// with a JSON content-type and no body sends, as our own admin calls do for
// action-only endpoints (e.g. POST /speakers/rotate-featured). Treat an empty
// JSON body as `{}` rather than a client error.
// Fastify already registers a built-in JSON parser, so ours has to replace it.
app.removeContentTypeParser("application/json");
app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_request, body: string, done) => {
    if (!body || body.trim() === "") return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch {
      // Malformed JSON is a client error. Without an explicit statusCode the
      // default handler would turn it into a 500 — and, since #118, raise a
      // bogus server-error alert.
      const err = new Error("Invalid JSON body") as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  },
);

// Per-request decorations attached by auth middleware. Declared without a
// default so Fastify treats them as optional getters (the typings live in
// src/types/fastify.d.ts as `field?: T`). Reading them before the auth
// preHandler runs returns undefined.
app.decorateRequest("adminUser");
app.decorateRequest("authContext");

// Who is acting and through which door, for the audit log (#513). Registered
// before every route so no write escapes it.
registerRequestContext(app);

// Server errors are logged as today, and additionally pushed to the alert
// webhook when one is configured (#118). Only 5xx are alerted: 4xx are client
// mistakes, not incidents. The reply itself keeps Fastify's default shape.
app.setErrorHandler((err: FastifyError, request, reply) => {
  const statusCode = err.statusCode ?? 500;

  if (statusCode >= 500) {
    request.log.error({ err, route: request.routeOptions.url }, "Server error");

    // Fire-and-forget: alerting must never delay or break the response.
    void sendAlert(
      buildAlertPayload({
        method: request.method,
        // Route pattern, not the raw URL — keeps identifying data out of the alert.
        route: request.routeOptions.url ?? request.url.split("?")[0],
        statusCode,
        error: err,
      }),
    ).then((result) => {
      if (result.status === "failed") {
        request.log.warn({ error: result.error }, "Alert webhook delivery failed");
      }
    });
  }

  reply.send(err);
});

const corsOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  process.env.BASE_URL || "http://localhost:3000",
];
await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
});

await app.register(compress);
await app.register(helmet, {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true },
  xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
});

// Rate limit per IP and per minute: 200 requests on the API, a separate and
// larger budget on the static uploads (#469). Details in rate-limit-options.ts,
// shared with the test that exercises both buckets.
await app.register(rateLimit, rateLimitOptions);

await app.register(multipart);
await app.register(fastifyStatic, {
  root: "/app/uploads",
  prefix: UPLOADS_PREFIX,
  decorateReply: false,
  // Uploaded files are content-addressed by name (`${Date.now()}-${random}.ext`,
  // see routes/admin/files.ts): a given URL never changes content, so it can be
  // cached hard and forever. Without this, a 3 MB hero image was re-downloaded
  // on every visit (#197).
  maxAge: "365d",
  immutable: true,
  // Defence in depth for SVG (#346). Uploads are sanitized before storage, but
  // a file predating that — or a case the allowlist misses — must still be
  // inert when opened directly: served same-origin with its native
  // content-type, an SVG runs script in our origin. `sandbox` drops it into an
  // opaque origin with scripts disabled; `nosniff` stops a mislabelled file
  // from being reinterpreted as something executable.
  setHeaders: (reply, filePath) => {
    reply.setHeader("X-Content-Type-Options", "nosniff");
    if (filePath.toLowerCase().endsWith(".svg")) {
      reply.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'");
    }
  },
});

// OpenAPI / Swagger — must be registered before routes so it can capture their schemas.
// Exposes /api/docs (UI) and /api/docs/json (raw spec).
//
// In production the docs list every admin endpoint (schema, query params,
// auth scheme) which is great for internal use but also shortens the recon
// loop for attackers. Gate the UI and spec behind SWAGGER_PUBLIC=true (or
// non-production env) so the default prod deployment keeps them off.
const swaggerPublic = process.env.SWAGGER_PUBLIC === "true" || process.env.NODE_ENV !== "production";
if (swaggerPublic) {
  await registerSwagger(app);
} else {
  app.log.info("[swagger] /api/docs disabled in production (set SWAGGER_PUBLIC=true to re-enable)");
}
registerCommonSchemas(app);
registerApiKeySchemas(app);

// Health check
app.get("/api/health", {
  schema: {
    tags: ["health"],
    summary: "Sonde de santé du service",
    response: {
      200: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok"] },
          timestamp: { type: "string", format: "date-time" },
          version: { type: "string" },
          environment: { type: "string" },
          // Short SHA of the deployed build. Absent outside CI/Coolify, hence
          // not in `required` — the serializer would drop it silently anyway.
          commit: { type: "string" },
        },
        required: ["status", "timestamp", "version", "environment"],
      },
    },
  },
}, async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    environment: APP_ENVIRONMENT,
    ...(APP_COMMIT && { commit: APP_COMMIT }),
  };
});

// Auth providers availability
app.get("/api/auth/providers", {
  schema: {
    tags: ["auth"],
    summary: "Fournisseurs OAuth activés",
    response: {
      200: {
        type: "object",
        properties: {
          google: { type: "boolean" },
          github: { type: "boolean" },
        },
      },
    },
  },
}, async () => {
  return {
    google: !!(process.env.OAUTH_GOOGLE_CLIENT_ID && process.env.OAUTH_GOOGLE_CLIENT_SECRET),
    github: !!(process.env.OAUTH_GITHUB_CLIENT_ID && process.env.OAUTH_GITHUB_CLIENT_SECRET),
  };
});

// Auth routes and OAuth discovery, handed to better-auth (plugins/auth-routes.ts).
await registerAuthRoutes(app);

// Public API routes
await app.register(editionRoutes, { prefix: "/api" });
await app.register(calendarRoutes, { prefix: "/api" });
await app.register(articleRoutes, { prefix: "/api" });
await app.register(settingsRoutes, { prefix: "/api" });
await app.register(pageRoutes, { prefix: "/api" });
await app.register(contactRoutes, { prefix: "/api" });
await app.register(brochureRoutes, { prefix: "/api" });
await app.register(sponsorRoutes, { prefix: "/api" });
await app.register(speakerRoutes, { prefix: "/api" });
await app.register(categoryRoutes, { prefix: "/api" });
await app.register(talkRoutes, { prefix: "/api" });
await app.register(replayRoutes, { prefix: "/api" });
await app.register(editRoutes, { prefix: "/api" });
await app.register(sponsorInvitationRoutes, { prefix: "/api" });
await app.register(sponsorSpaceRoutes, { prefix: "/api" });

// Per-user routes (any authenticated back-office user — own resources only)
await app.register(myApiKeysRoutes, { prefix: "/api/me" });

// Maintenance routes driven by an external scheduler (#149). Deliberately
// outside the admin group: the cron has no session, so the route checks a
// shared secret or an ADMIN session itself.
await app.register(maintenanceRoutes, { prefix: "/api" });

// Admin routes (protected by requireAdmin hook)
await app.register(adminRoutes, { prefix: "/api/admin" });

try {
  await app.listen({ port, host });
  startScheduledTasks(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
