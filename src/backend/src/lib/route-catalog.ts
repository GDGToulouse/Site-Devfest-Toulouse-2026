import type { FastifyInstance } from "fastify";

// What an AI agent can ask the API (#514): every route, read off Fastify as it
// is registered. The OpenAPI document would say the same, but Swagger is off in
// production; and the catalogue grants nothing — /api/mcp calls the route
// through its usual guards, which decide.

export interface CatalogRoute {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  params?: unknown;
  querystring?: unknown;
  body?: unknown;
}

// Not for an agent: its own endpoint (no recursion), account and OAuth
// plumbing (an agent must not manage sign-ins, mint clients or revoke other
// agents), static files and the API docs.
const HIDDEN_PREFIXES = ["/api/mcp", "/api/auth", "/api/me/agents", "/.well-known", "/uploads", "/api/docs"];

export function isHiddenFromAgents(path: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}*`));
}

const routes: CatalogRoute[] = [];

/** Record routes as they are registered. Call before registering any route. */
export function registerRouteCatalog(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    if (isHiddenFromAgents(route.url)) return;
    const schema = (route.schema ?? {}) as Record<string, unknown>;
    for (const method of [route.method].flat()) {
      // Fastify adds HEAD next to every GET; OPTIONS is CORS plumbing.
      if (method === "HEAD" || method === "OPTIONS") continue;
      routes.push({
        method,
        path: route.url,
        ...(typeof schema.summary === "string" && { summary: schema.summary }),
        ...(typeof schema.description === "string" && { description: schema.description }),
        ...(schema.params !== undefined && { params: schema.params }),
        ...(schema.querystring !== undefined && { querystring: schema.querystring }),
        ...(schema.body !== undefined && { body: schema.body }),
      });
    }
  });
}

export function listCatalogRoutes(): readonly CatalogRoute[] {
  return routes;
}
