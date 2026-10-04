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

// Not for an agent: its own endpoint (no recursion), account, key and OAuth
// plumbing (an agent must not manage sign-ins, keys, accounts or other agents),
// static files and the API docs. Only a convenience: the agent's token reaches
// the routes directly too, so the ones that matter refuse it themselves
// (refuseAgents in auth-context.ts).
const HIDDEN_PREFIXES = [
  "/api/mcp",
  "/api/auth",
  "/api/me/agents",
  "/api/me/api-keys",
  "/api/admin/users",
  "/api/admin/api-keys",
  "/.well-known",
  "/uploads",
  "/api/docs",
];

export function isHiddenFromAgents(path: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}*`));
}

const routes: CatalogRoute[] = [];
// Every method and URL registered, hidden ones included: route-guards.test.ts
// checks that its inventory missed none.
const registered: Array<{ method: string; path: string }> = [];

/** Record routes as they are registered. Call before registering any route. */
export function registerRouteCatalog(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const schema = (route.schema ?? {}) as Record<string, unknown>;
    for (const method of [route.method].flat()) {
      // Fastify adds HEAD next to every GET; OPTIONS is CORS plumbing.
      if (method === "HEAD" || method === "OPTIONS") continue;
      registered.push({ method, path: route.url });
      if (isHiddenFromAgents(route.url)) continue;
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

export function listRegisteredRoutes(): ReadonlyArray<{ method: string; path: string }> {
  return registered;
}
