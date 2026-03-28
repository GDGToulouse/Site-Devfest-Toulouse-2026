import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "dev-secret";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { secret, paths } = body;

  if (secret !== REVALIDATE_SECRET) {
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
