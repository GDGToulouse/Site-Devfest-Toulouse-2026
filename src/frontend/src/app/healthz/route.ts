import { NextResponse } from "next/server";

// Liveness probe for the container healthcheck. Deliberately does not touch the
// backend: probing `/` would render the home page, which fetches the API, so a
// backend outage would mark the frontend unhealthy and block deployments even
// though Next.js is serving fine.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
