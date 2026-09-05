import fs from "node:fs";
import path from "node:path";

import { prisma } from "./prisma.js";
import { FILE_ONLY_MODELS, TRASH_ENTITIES } from "./trash-registry.js";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

// Every column that can point at an /uploads/ path, derived from the single
// source of truth (each entity's `fileFields` in the registry, plus the models
// that hold uploads without being soft-deletable). Purging a row must not
// delete a file another row still shows: uploads live in a shared library
// (/admin/files), they are not owned by the referencing entity.
//
// Verified on real data: one image was already referenced by two articles. A
// naive "delete the row's files" purge would have broken the survivor's image.
//
// Deriving this instead of maintaining a second flat list (the old shape) means
// adding an entity with an upload column can no longer forget to update the
// reference count — the bug this comment used to warn about.
export const FILE_REFERENCES: readonly { model: string; field: string }[] = [
  ...TRASH_ENTITIES.flatMap((entity) =>
    entity.fileFields.map((field) => ({ model: entity.model, field })),
  ),
  ...FILE_ONLY_MODELS.flatMap((entity) =>
    entity.fileFields.map((field) => ({ model: entity.model, field })),
  ),
];

type CountDelegate = { count: (args: unknown) => Promise<number> };

/** One place an upload is used, as the admin needs to hear it. */
export interface FileReferenceUsage {
  model: string;
  field: string;
  count: number;
}

/**
 * The site-wide settings are key/value rows, not typed columns: the logos, the
 * favicons, the home carousel and the OG image all live in `SiteSetting.value`
 * (#486). They are the most visible references of all — deleting the site logo
 * breaks the header of every page — so they are counted too.
 *
 * A substring match, since `about_carousel` stores a JSON array rather than a
 * bare URL. It can only over-count (one filename being the prefix of another),
 * and over-counting merely refuses a deletion — the safe direction.
 */
async function countSettingReferences(url: string): Promise<number> {
  return prisma.siteSetting.count({ where: { value: { contains: url } } });
}

/**
 * Where an upload is still used, ignoring one row about to go.
 *
 * Counts across ALL entities, trashed ones included: a trashed row can still be
 * restored, and it would come back to a missing image otherwise.
 */
export async function listFileReferences(
  url: string,
  excluding?: { model: string; id: number | string },
): Promise<FileReferenceUsage[]> {
  const usages: FileReferenceUsage[] = [];

  for (const ref of FILE_REFERENCES) {
    const delegate = (prisma as unknown as Record<string, CountDelegate>)[ref.model];
    if (!delegate) continue;
    const where: Record<string, unknown> = { [ref.field]: url };
    if (excluding && ref.model === excluding.model) where.id = { not: excluding.id };
    const count = await delegate.count({ where });
    if (count > 0) usages.push({ model: ref.model, field: ref.field, count });
  }

  const settings = await countSettingReferences(url);
  if (settings > 0) usages.push({ model: "siteSetting", field: "value", count: settings });

  return usages;
}

/** How many rows still point at this upload. See `listFileReferences`. */
export async function countFileReferences(
  url: string,
  excluding?: { model: string; id: number | string },
): Promise<number> {
  const usages = await listFileReferences(url, excluding);
  return usages.reduce((total, usage) => total + usage.count, 0);
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
