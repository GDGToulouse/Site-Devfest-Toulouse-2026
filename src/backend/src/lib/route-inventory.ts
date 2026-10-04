import type { FastifyInstance } from "fastify";

// Every route of the real server with the preHandler hooks it runs, inherited
// ones included (#514). Fastify exposes those only through printRoutes, as a
// text tree; this reads it back. Used by route-guards.test.ts, which fails when
// a route that writes carries no known guard, and by the inventory script
// behind docs/audit-droits-api.md.

export interface InventoryRoute {
  method: string;
  path: string;
  preHandlers: string[];
}

/** The guard hooks the API uses, with who gets through each. */
export const KNOWN_GUARDS: Record<string, string> = {
  requireAdmin: "Équipe (ADMIN, EDITOR)",
  requireAdminRole: "ADMIN",
  requireAnyAuthenticated: "Équipe (ADMIN, EDITOR)",
  requireBrowserSession: "Tout compte, depuis le navigateur",
  requireSponsorAccess_STAND: "Contact du sponsor (STAND et plus) ou ADMIN",
  requireSponsorAccess_EDITEUR: "Contact du sponsor (EDITEUR et plus) ou ADMIN",
  requireSponsorAccess_RESPONSABLE: "Contact du sponsor (RESPONSABLE) ou ADMIN",
};

/**
 * Routes with no guard hook on purpose, and why. `anonymous` lists the status
 * an anonymous call must get: route-guards.test.ts probes each one, so a
 * reason that stops being true fails the suite.
 */
export const SELF_GUARDED: Record<string, { why: string; anonymous?: number[] }> = {
  "GET /api/admin/session": { why: "dit qui est connecté ; vérifie la session elle-même", anonymous: [403] },
  "PUT /api/admin/profile": { why: "renomme l'appelant ; vérifie la session elle-même", anonymous: [403] },
  "GET /api/sponsor-space/mine": { why: "liste les sponsors de l'appelant ; vérifie la session elle-même", anonymous: [401] },
  "GET /api/sponsor-space/me": { why: "dit qui est connecté ; vérifie la session elle-même", anonymous: [401] },
  "PUT /api/edit/:token": { why: "lien de modification du speaker : le jeton est l'accès", anonymous: [404] },
  "PUT /api/edit/:token/talks/:talkId": { why: "lien de modification du speaker : le jeton est l'accès", anonymous: [404] },
  "POST /api/edit/:token/upload": { why: "lien de modification du speaker : le jeton est l'accès", anonymous: [404, 406] },
  "POST /api/sponsor-invitation/:token/accept": {
    why: "jeton d'invitation, puis l'e-mail de la session doit correspondre",
    anonymous: [404],
  },
  "POST /api/contact/send": { why: "formulaire de contact public : tout le monde peut écrire, débit limité" },
  "POST /api/maintenance/purge-trash": { why: "secret partagé du cron, ou session ADMIN", anonymous: [401] },
  "POST /api/mcp": { why: "jeton OAuth d'un agent IA, vérifié par la route", anonymous: [401] },
  "DELETE /api/mcp": { why: "toujours 405 : le serveur MCP est sans état", anonymous: [405] },
};

/** Who may call a route, in words, for the inventory. */
export function accessOf(route: InventoryRoute): string {
  const guard = route.preHandlers.find((name) => KNOWN_GUARDS[name]);
  if (guard) return KNOWN_GUARDS[guard];
  const self = SELF_GUARDED[`${route.method} ${route.path}`];
  return self ? `Contrôlé dans la route : ${self.why}` : "Public";
}

// "│   ├── /speakers/:id (GET, HEAD)" — a node, opened by a branch glyph — or
// "│   /speakers/:id (POST)": the same node, another set of methods.
const ROUTE_LINE = /^([│ ]*)(├── |└── )?(.+?) \(([A-Z, ]+)\)$/;
const HOOK_LINE = /• \((\w+)\) \[(.*)\]$/;

function hookNames(list: string): string[] {
  return [...list.matchAll(/"([^"]*)\(\)"/g)].map((match) => match[1]);
}

export function parseRouteTree(tree: string): InventoryRoute[] {
  const routes: InventoryRoute[] = [];
  const pathAtDepth: string[] = [];
  let current: InventoryRoute[] = [];

  for (const line of tree.split("\n")) {
    const route = ROUTE_LINE.exec(line);
    if (route) {
      const [, prefix, glyph, segment, methods] = route;
      // Four characters per level; a line without a glyph continues the node
      // its prefix already sits under.
      const depth = prefix.length / 4 - (glyph ? 0 : 1);
      const parent = depth > 0 ? pathAtDepth[depth - 1] : "";
      const path = parent + segment;
      pathAtDepth[depth] = path;
      pathAtDepth.length = depth + 1;
      current = methods.split(", ").map((method) => ({ method, path, preHandlers: [] }));
      routes.push(...current);
      continue;
    }
    const hook = HOOK_LINE.exec(line);
    if (hook && hook[1] === "preHandler") {
      for (const entry of current) entry.preHandlers.push(...hookNames(hook[2]));
    }
  }
  return routes;
}

export function inventoryOf(app: FastifyInstance): InventoryRoute[] {
  return parseRouteTree(app.printRoutes({ commonPrefix: false, includeHooks: true }));
}
