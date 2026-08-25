import path from "node:path";

import { prisma } from "./prisma.js";

// The name a file had on the uploader's machine (#378). Stored names are
// `<timestamp>-<random>.<ext>` and identify nothing; a PDF has no thumbnail to
// recognise it by either, so the sponsor who dropped their graphic charter sees
// a row of interchangeable URLs.
//
// It lives on FileMetadata rather than in the stored filename on purpose:
// /uploads/ is served without authentication, and a document called
// "budget-2026-confidentiel.pdf" has no business announcing itself in a public
// URL. The name belongs to the screens that are behind a login.

// Long enough for any real filename, short enough that a crafted one cannot be
// used to bloat a listing.
const MAX_LENGTH = 255;

/** Everything a browser sends can be hostile: keep the basename, nothing else. */
function clean(name: string): string | null {
  // `path.basename` handles POSIX separators; Windows browsers can send a full
  // `C:\Users\…\file.pdf`, whose separator basename() leaves alone on Linux.
  const base = path.basename(name).split("\\").pop() ?? "";
  const trimmed = base.trim().slice(0, MAX_LENGTH);
  return trimmed.length > 0 && trimmed !== "." && trimmed !== ".." ? trimmed : null;
}

/**
 * Record the original name of a file just stored under /uploads/.
 *
 * Takes the public URL because that is what `storeImageBuffer` returns — the
 * store itself stays free of any database dependency.
 */
export async function rememberOriginalName(url: string, originalName: string | undefined): Promise<void> {
  if (!originalName) return;
  const filename = url.split("/").pop();
  if (!filename) return;

  const cleaned = clean(originalName);
  if (!cleaned) return;

  await prisma.fileMetadata.upsert({
    where: { filename },
    update: { originalName: cleaned },
    create: { filename, originalName: cleaned },
  });
}

/**
 * Resolve the original names of a batch of /uploads/ URLs.
 *
 * One query for the whole set: the sponsor space asks for its four file fields
 * at once, and the file library for a whole page of them.
 */
export async function originalNamesByUrl(urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const filenames = [...new Set(urls.filter((u): u is string => Boolean(u) && u!.startsWith("/uploads/")))].map(
    (u) => u.slice("/uploads/".length),
  );
  if (filenames.length === 0) return {};

  const rows = await prisma.fileMetadata.findMany({
    where: { filename: { in: filenames }, originalName: { not: null } },
    select: { filename: true, originalName: true },
  });

  return Object.fromEntries(rows.map((r) => [`/uploads/${r.filename}`, r.originalName as string]));
}

export const __testing = { clean };
