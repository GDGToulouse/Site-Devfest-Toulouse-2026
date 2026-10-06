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

/** One row using an upload, named the way the admin knows it (#483). */
export interface FileUsage {
  model: string;
  id: number | string;
  label: string;
  isTrashed: boolean;
}

type ListDelegate = { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };

/**
 * Who uses each of these uploads, by name (#483): the media library shows it
 * under the thumbnail and filters on it. Derived from the same columns as the
 * reference count, never typed in, so it stays true when a photo moves.
 *
 * One query per model/column pair and one for the settings, whatever the
 * number of files: the library lists hundreds, and a query per file would be
 * an N+1 on every page load. Trashed rows are included, flagged: they can come
 * back, and their file with them.
 *
 * An image placed inside a rich-text body is not a column reference, so it is
 * not seen here; the screen says "aucun usage référencé", not "unused".
 */
export async function listFileUsages(urls: readonly string[]): Promise<Map<string, FileUsage[]>> {
  const byUrl = new Map<string, FileUsage[]>();
  if (urls.length === 0) return byUrl;
  const add = (url: unknown, usage: FileUsage) => {
    if (typeof url !== "string") return;
    byUrl.set(url, [...(byUrl.get(url) ?? []), usage]);
  };
  const list = [...urls];

  for (const entity of TRASH_ENTITIES) {
    const delegate = (prisma as unknown as Record<string, ListDelegate>)[entity.model];
    for (const field of entity.fileFields) {
      const rows = await delegate.findMany({
        where: { [field]: { in: list } },
        select: { id: true, deletedAt: true, [field]: true, [entity.labelField]: true },
      });
      for (const row of rows) {
        add(row[field], {
          model: entity.model,
          id: row.id as number,
          label: String(row[entity.labelField]),
          isTrashed: row.deletedAt != null,
        });
      }
    }
  }

  // A participation is named after its company and year: that is the logo the
  // edition froze (#375), not the company's current one.
  for (const field of FILE_ONLY_MODELS.find((m) => m.model === "editionSponsor")?.fileFields ?? []) {
    const rows = await (prisma.editionSponsor as unknown as ListDelegate).findMany({
      where: { [field]: { in: list } },
      select: { id: true, [field]: true, sponsor: { select: { name: true, deletedAt: true } }, edition: { select: { year: true } } },
    });
    for (const row of rows) {
      const sponsor = row.sponsor as { name: string; deletedAt: Date | null };
      const edition = row.edition as { year: number };
      add(row[field], { model: "editionSponsor", id: row.id as number, label: `${sponsor.name} (${edition.year})`, isTrashed: sponsor.deletedAt != null });
    }
  }

  // Settings hold URLs inside values (the carousel is a JSON array): fetched
  // once, matched in memory. They are a few dozen rows.
  const settings = await prisma.siteSetting.findMany({
    where: { value: { contains: "/uploads/" } },
    select: { key: true, value: true },
  });
  for (const url of list) {
    for (const setting of settings) {
      if (setting.value.includes(url)) add(url, { model: "siteSetting", id: setting.key, label: setting.key, isTrashed: false });
    }
  }

  return byUrl;
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
