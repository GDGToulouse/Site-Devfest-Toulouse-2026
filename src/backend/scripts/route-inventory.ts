// Print the API route inventory as a Markdown table (#514): every route of the
// real server, the guard it runs and who gets through. Pasted into
// docs/audit-droits-api.md; re-run it when routes change.
//
// Usage (from src/backend/, in the backend container):
//   LOG_LEVEL=silent pnpm exec tsx scripts/route-inventory.ts

import { buildServer } from "../src/server.js";
import { accessOf, inventoryOf } from "../src/lib/route-inventory.js";
import { listRegisteredRoutes } from "../src/lib/route-catalog.js";

const AREAS: Array<[string, string]> = [
  ["/api/admin/", "Back-office"],
  ["/api/me/", "Compte"],
  ["/api/sponsor-space/", "Espace partenaire"],
  ["/api/edit/", "Lien de modification speaker"],
  ["/api/mcp", "Connecteur MCP"],
  ["/api/", "Public et divers"],
];

const app = await buildServer();
await app.ready();

const printed = inventoryOf(app).filter((r) => r.method !== "HEAD" && r.method !== "OPTIONS");
const printedKeys = new Set(printed.map((r) => `${r.method} ${r.path}`));
// The route printer leaves wildcard routes out: list them from registration.
const unprinted = listRegisteredRoutes()
  .filter((r) => !printedKeys.has(`${r.method} ${r.path}`))
  .map((r) => ({ ...r, preHandlers: [] as string[] }));
const routes = [...printed, ...unprinted].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const areaOf = (path: string) => AREAS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "Hors API";

for (const [, area] of [...AREAS, ["", "Hors API"] as [string, string]]) {
  const inArea = routes.filter((r) => areaOf(r.path) === area);
  if (inArea.length === 0) continue;
  console.log(`\n### ${area} (${inArea.length})\n`);
  console.log("| Méthode | Route | Qui peut l'appeler |");
  console.log("|---|---|---|");
  for (const route of inArea) {
    const access = route.path.startsWith("/api/auth/") || route.path.startsWith("/.well-known/")
      ? "better-auth (connexion, OAuth)"
      : accessOf(route);
    console.log(`| ${route.method} | \`${route.path}\` | ${access} |`);
  }
}

await app.close();
process.exit(0);
