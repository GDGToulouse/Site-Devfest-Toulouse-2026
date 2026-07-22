import { timingSafeEqual } from "node:crypto";

import { TRASH_ENTITIES, delegateFor } from "./trash-registry.js";
import { purgeFiles } from "./trash-files.js";

/**
 * Automatic purge of the trash (#149).
 *
 * Rows are kept for a grace period after deletion, then destroyed for good. The
 * schedule lives outside the process (a Coolify cron calling the endpoint)
 * rather than in an in-process timer: nothing to restart, nothing that fires
 * twice when two containers run, and it stays visible in the deploy config.
 */

const DEFAULT_RETENTION_DAYS = 30;

/** Retention window, overridable per environment. Falls back on a bad value. */
export function retentionDays(): number {
  const raw = process.env.TRASH_RETENTION_DAYS;
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const parsed = Number(raw);
  // A typo must not silently become "purge everything immediately".
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RETENTION_DAYS;
  return Math.floor(parsed);
}

export function cutoffDate(now: Date = new Date(), days: number = retentionDays()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Is this request allowed to run the purge?
 *
 * The cron has no session, so it carries a shared secret instead. Compared in
 * constant time — a byte-by-byte early exit leaks the secret one character at a
 * time to anyone who can measure the response.
 */
export function isValidPurgeSecret(provided: string | undefined): boolean {
  const expected = process.env.TRASH_PURGE_SECRET;
  // No secret configured means no secret-based access — never "allow anyone".
  if (!expected || !provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch, so guard first. The length of a
  // secret is not the secret.
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface EntityPurgeResult {
  entity: string;
  purged: number;
  filesDeleted: number;
  filesKept: number;
}

export interface PurgeReport {
  cutoff: string;
  retentionDays: number;
  entities: EntityPurgeResult[];
  totalPurged: number;
}

/**
 * Destroy every trashed row older than the cutoff, and the files they owned.
 *
 * Idempotent: with nothing old enough, every counter is zero and no write
 * happens — a cron firing twice, or retrying, is harmless.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<PurgeReport> {
  const days = retentionDays();
  const cutoff = cutoffDate(now, days);
  const entities: EntityPurgeResult[] = [];

  for (const entity of TRASH_ENTITIES) {
    const delegate = delegateFor(entity);

    // `{ lt: cutoff }` alone is the filter: SQL comparisons never match NULL,
    // so live rows are excluded by construction. Spreading `onlyDeleted` here
    // would set the same key twice and read as if both applied.
    const expired = await delegate.findMany({
      where: { deletedAt: { lt: cutoff } },
    });

    let purged = 0;
    let filesDeleted = 0;
    let filesKept = 0;

    for (const row of expired) {
      const id = row.id as number | string;
      const fileUrls = entity.fileFields.map((f) => row[f] as string | null);

      // One row at a time rather than a bulk deleteMany: each row's files have
      // to be reference-counted after its own deletion, and a failure on one
      // row must not abort the rest of the sweep.
      try {
        await delegate.delete({ where: { id } });
      } catch {
        // Already gone (a manual purge raced us), or blocked by a foreign key.
        // Skip it; the next run will retry.
        continue;
      }

      purged++;

      const outcomes = await purgeFiles(fileUrls, { model: entity.model, id });
      for (const o of outcomes) {
        if (o.deleted) filesDeleted++;
        else if (o.reason === "still_referenced") filesKept++;
      }
    }

    entities.push({ entity: entity.key, purged, filesDeleted, filesKept });
  }

  return {
    cutoff: cutoff.toISOString(),
    retentionDays: days,
    entities,
    totalPurged: entities.reduce((sum, e) => sum + e.purged, 0),
  };
}
