import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { redactUrl } from "./lib/log-redact.js";
import { trustedOrigins } from "./lib/auth.js";
import { buildAlertPayload, sendAlert } from "./lib/alert-webhook.js";
import { registerRequestContext } from "./lib/request-context.js";
import { registerRouteCatalog } from "./lib/route-catalog.js";
import mcpRoutes from "./routes/mcp.js";
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
import faqRoutes from "./routes/faq.js";
import teamRoutes from "./routes/team.js";
import contactRoutes from "./routes/contact.js";
import talkFeedbackRoutes from "./routes/talk-feedback.js";
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
import myAgentsRoutes from "./routes/me/agents.js";
import adminRoutes from "./routes/admin/index.js";
import { serverOptions } from "./lib/server-options.js";
import { rateLimitOptions, UPLOADS_PREFIX } from "./lib/rate-limit-options.js";

/**
 * The whole HTTP application, routes included, without listening. Shared by the
 * entry point and by the tests that check the real composition — a guard only
 * the real server carries is a guard nothing checks (#514).
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isInvalidInput(err: Error): boolean {
  if (err.name === "PrismaClientValidationError") return true;
  // PostgreSQL's class 22 is "data exception": the value, not the server.
  const cause = (err as { cause?: { kind?: string; code?: string } }).cause;
  return err.name === "DriverAdapterError" && cause?.kind === "postgres" && !!cause.code?.startsWith("22");
}

export async function buildServer() {
  // LOG_LEVEL: set to "debug" (or "trace") to enable verbose .debug() entries
  // scattered across the codebase (auth guards, proxy, etc.). Defaults to "info"
  // so debug entries are filtered out in normal runs and free to leave in place
  // as a permanent diagnostic tool.
  //
  // The rest lives in serverOptions, shared with the test that probes the router
  // (#467) — a limit only the real server carries is a limit nothing checks.
  const app = Fastify({
    ...serverOptions,
    logger: {
      level: process.env.LOG_LEVEL || "info",
      // Fastify's own request fields, the URL with its bearer secrets masked
      // (#658): edit links, invitations and magic links travel in it.
      serializers: {
        req: (req) => ({
          method: req.method,
          url: redactUrl(req.url),
          host: req.host,
          remoteAddress: req.ip,
          remotePort: req.socket?.remotePort,
        }),
      },
    },
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

  // The routes an AI agent can list through /api/mcp (#514), recorded as they
  // are registered — so before any of them.
  registerRouteCatalog(app);

  // Server errors are logged as today, and additionally pushed to the alert
  // webhook when one is configured (#118). Only 5xx are alerted: 4xx are client
  // mistakes, not incidents. The reply itself keeps Fastify's default shape.
  app.setErrorHandler((err: FastifyError, request, reply) => {
    // A value the database cannot take (out of range, malformed, a NUL byte)
    // is the caller's mistake: a 400, not a server error paging the team.
    if (isInvalidInput(err)) {
      request.log.warn({ err, route: request.routeOptions.url }, "Invalid input rejected by the database");
      return reply.code(400).send({ error: "invalid_input", message: "Paramètre invalide." });
    }

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

    // The detail of a server error stays in the logs: Prisma's message quotes
    // the query, the tables and the source path (#658). The request id ties
    // the answer to its log line.
    if (statusCode >= 500) {
      return reply.code(statusCode).send({ error: "Internal Server Error", requestId: request.id });
    }
    reply.send(err);
  });

  // SameSite=Lax stops cross-site writes, not same-site ones: a page anywhere
  // under the registered domain (old sites, other environments) gets the
  // session cookie attached. A write carried by that cookie must name one of
  // our origins (#658). Bearer calls carry no ambient credential, and
  // better-auth checks its own routes.
  app.addHook("onRequest", async (request, reply) => {
    if (SAFE_METHODS.has(request.method) || request.url.startsWith("/api/auth/")) return;
    if (request.headers.authorization || !request.headers.cookie?.includes("session_token=")) return;
    const origin = request.headers.origin;
    const isOwnOrigin = origin ? trustedOrigins.includes(origin) : request.headers["sec-fetch-site"] === "same-origin";
    if (!isOwnOrigin) {
      return reply.code(403).send({ error: "invalid_origin", message: "Requête refusée : origine inconnue." });
    }
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
  await app.register(faqRoutes, { prefix: "/api" });
  await app.register(teamRoutes, { prefix: "/api" });
  await app.register(contactRoutes, { prefix: "/api" });
  await app.register(brochureRoutes, { prefix: "/api" });
  await app.register(sponsorRoutes, { prefix: "/api" });
  await app.register(speakerRoutes, { prefix: "/api" });
  await app.register(categoryRoutes, { prefix: "/api" });
  await app.register(talkRoutes, { prefix: "/api" });
  await app.register(talkFeedbackRoutes, { prefix: "/api" });
  await app.register(replayRoutes, { prefix: "/api" });
  await app.register(editRoutes, { prefix: "/api" });
  await app.register(sponsorInvitationRoutes, { prefix: "/api" });
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });

  // Per-user routes (any authenticated back-office user — own resources only)
  await app.register(myApiKeysRoutes, { prefix: "/api/me" });
  // Any account, sponsors included: the AI agents they connected (#514).
  await app.register(myAgentsRoutes, { prefix: "/api/me" });

  // Maintenance routes driven by an external scheduler (#149). Deliberately
  // outside the admin group: the cron has no session, so the route checks a
  // shared secret or an ADMIN session itself.
  await app.register(maintenanceRoutes, { prefix: "/api" });

  // The MCP server for AI agents (#514): authenticates its own OAuth tokens, then
  // replays each call against the routes above with them.
  await app.register(mcpRoutes, { prefix: "/api" });

  // Admin routes (protected by requireAdmin hook)
  await app.register(adminRoutes, { prefix: "/api/admin" });

  return app;
}
