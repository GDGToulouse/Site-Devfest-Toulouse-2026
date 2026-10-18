import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

// Leaves the draft preview (#618) and returns to the same page, now as the
// public sees it. Only a path of the public site is accepted as the way back:
// anything else, an absolute URL or `//host` included, falls back to the home.
export const dynamic = "force-dynamic";

const PUBLIC_PATH = /^\/(fr|en)(\/[^/\\][^\\]*)?$/;

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  (await draftMode()).disable();
  redirect(PUBLIC_PATH.test(path) ? path : "/");
}
