import fs from "node:fs";
import path from "node:path";

import { prisma } from "./prisma.js";
import { TRASH_ENTITIES } from "./trash-registry.js";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

// Every column that can point at an /uploads/ path, derived from the single
// source of truth (each entity's `fileFields` in the registry). Purging a row
// must not delete a file another row still shows: uploads live in a shared
// library (/admin/files), they are not owned by the referencing entity.
//
// Verified on real data: one image was already referenced by two articles. A
// naive "delete the row's files" purge would have broken the survivor's image.
//
// Deriving this instead of maintaining a second flat list (the old shape) means
// adding an entity with an upload column can no longer forget to update the
// reference count — the bug this comment used to warn about.
export const FILE_REFERENCES: readonly { model: string; field: string }[] = TRASH_ENTITIES.flatMap(
  (entity) => entity.fileFields.map((field) => ({ model: entity.model, field })),
);

type CountDelegate = { count: (args: unknown) => Promise<number> };

/**
 * How many rows still point at this upload, ignoring one row about to go.
 *
 * Counts across ALL entities, trashed ones included: a trashed row can still be
 * restored, and it would come back to a missing image otherwise.
 */
export async function countFileReferences(
  url: string,
  excluding: { model: string; id: number | string },
): Promise<number> {
  let total = 0;
  for (const ref of FILE_REFERENCES) {
    const delegate = (prisma as unknown as Record<string, CountDelegate>)[ref.model];
    if (!delegate) continue;
    const where: Record<string, unknown> = { [ref.field]: url };
    if (ref.model === excluding.model) where.id = { not: excluding.id };
    total += await delegate.count({ where });
  }
  return total;
}

/** Guard against a crafted path escaping the uploads directory. */
function resolveUploadPath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const name = path.basename(url);
  if (!name || name === "." || name === "..") return null;
  const full = path.join(UPLOADS_DIR, name);
  const root = path.resolve(UPLOADS_DIR);
  return path.resolve(full).startsWith(root) ? full : null;
}

export interface FilePurgeOutcome {
  url: string;
  deleted: boolean;
  reason?: "still_referenced" | "not_found" | "outside_uploads";
}

/**
 * Delete the files a purged row owned, skipping any still in use elsewhere.
 * Never throws: a purge that already removed the database row must not fail
 * because a file was missing from disk.
 */
export async function purgeFiles(
  urls: readonly (string | null | undefined)[],
  owner: { model: string; id: number | string },
): Promise<FilePurgeOutcome[]> {
  const outcomes: FilePurgeOutcome[] = [];

  for (const url of urls) {
    if (!url) continue;

    const stillUsed = await countFileReferences(url, owner);
    if (stillUsed > 0) {
      outcomes.push({ url, deleted: false, reason: "still_referenced" });
      continue;
    }

    const full = resolveUploadPath(url);
    if (!full) {
      outcomes.push({ url, deleted: false, reason: "outside_uploads" });
      continue;
    }

    try {
      await fs.promises.unlink(full);
      outcomes.push({ url, deleted: true });
    } catch {
      // Already gone, or never on this disk. The row is what mattered.
      outcomes.push({ url, deleted: false, reason: "not_found" });
    }
  }

  return outcomes;
}
