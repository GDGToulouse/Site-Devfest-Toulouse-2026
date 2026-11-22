import { describe, it, expect } from "vitest";

import nextConfig from "../../next.config";

// #864 — the Swagger page loads its scripts relative to its own address. The
// backend writes `./static/…` when it sees a trailing slash, but the browser
// stays on `/api/docs` (Next drops the slash), so `./static` resolved to
// `/api/static/…`, a 404: a blank page. Without the slash the backend writes
// absolute `/api/docs/static/…` paths.
describe("/api/docs relay", () => {
  it("should relay the Swagger page without a trailing slash", async () => {
    const rewrites = await nextConfig.rewrites!();
    const rules = Array.isArray(rewrites) ? rewrites : [...rewrites.beforeFiles, ...rewrites.afterFiles, ...rewrites.fallback];

    const docs = rules.find((rule) => rule.source === "/api/docs");

    expect(docs?.destination).toMatch(/\/api\/docs$/);
  });
});
