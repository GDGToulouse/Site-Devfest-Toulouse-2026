import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// REVALIDATE_SECRET must be set in production. If it's missing, revalidation
// is disabled outright (403 on every request) rather than falling back to a
// well-known placeholder like "dev-secret" that anyone on the Internet could
// use to purge the Next.js cache. Same approach on the backend side (see
// src/backend/src/lib/revalidate.ts).
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "";

if (!REVALIDATE_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[revalidate] REVALIDATE_SECRET not set — endpoint disabled.");
}

function constantTimeEqual(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers; pad the shorter one with
  // a different filler so unequal lengths always compare false without
  // leaking length via timing.
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  if (!REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Revalidation disabled" }, { status: 503 });
  }

  const body = await request.json();
  const { secret, paths } = body;

  if (typeof secret !== "string" || !constantTimeEqual(secret, REVALIDATE_SECRET)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "paths required" }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths });
}
