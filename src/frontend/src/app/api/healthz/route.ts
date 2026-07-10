import { NextResponse } from "next/server";

// Liveness probe for the container healthcheck (#192). Renders nothing and never
// calls the API: probing `/` would render the home page, which fetches the
// backend, so a backend outage would mark the frontend unhealthy and block
// deployments even though Next.js is serving fine.
//
// It has to live under `/api/` — the i18n routing redirects a bare `/healthz`
// to `/fr/healthz`, which does not exist, and the probe gets a 404. Paths under
// `/api/` are exempt. Note this is NOT `/api/health`, which next.config.ts
// rewrites to the backend.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
