import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Helpers that factor out boilerplate shared by most `/api/admin/*` routes:
 *
 *  - `parseIdParam(request)` : coerces `:id` to a positive integer and
 *    sends a 400 `{ error: "Invalid ID" }` if it isn't one. Returns `null`
 *    in that case so the caller can `return` early.
 *
 *  - `notFound(reply, resource)` : one-line 404 `{ error: "<resource> not found" }`.
 *
 *  - `pickPartial(existing, body, fields)` : builds a Prisma `data` object
 *    that applies only the fields present in `body`, falling back to the
 *    existing row for every field omitted. Coerces empty strings to `null`
 *    so an admin UI form that sends `""` to clear an optional field works
 *    as expected.
 *
 * The goal is to shrink the per-route CRUD boilerplate from ~25 lines to
 * ~10, without forcing a full routing framework on top of Fastify.
 */

export async function parseIdParam(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<number | null> {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.status(400).send({ error: "Invalid ID" });
    return null;
  }
  return id;
}

export function notFound(reply: FastifyReply, resource = "Resource") {
  return reply.status(404).send({ error: `${resource} not found` });
}

type PartialFields<T> = {
  [K in keyof T]?: T[K] | null | undefined;
};

/**
 * Build a Prisma-friendly update payload from a REST body. For every field
 * in `fields`:
 *   - if `body[f]` is undefined → keep `existing[f]`
 *   - if `body[f]` is a trimmed string that's empty → null
 *   - otherwise use the value (trimmed for strings)
 *
 * Intentionally strict: fields not listed are ignored (no mass assignment).
 */
export function pickPartial<T extends Record<string, unknown>>(
  existing: T,
  body: PartialFields<T>,
  fields: readonly (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const f of fields) {
    const raw = body[f];
    if (raw === undefined) continue; // not provided → keep existing
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      out[f] = (trimmed === "" ? null : trimmed) as T[typeof f];
    } else {
      out[f] = raw as T[typeof f];
    }
  }
  return out;
}

/**
 * Soft delete (#146, sub-step 1/5 of #145).
 *
 * Nothing below changes DELETE behaviour yet — the handlers still hard-delete
 * until #147 switches them over. This is the shared vocabulary they will use.
 */

/** Prisma `where` fragment selecting live rows. Spread it into any query. */
export const notDeleted = { deletedAt: null } as const;

/** Prisma `where` fragment selecting rows sitting in the trash. */
export const onlyDeleted = { deletedAt: { not: null } } as const;

// Slugs and names are unique per edition (`@@unique([editionId, slug])`), and a
// trashed row keeps occupying its slot: recreating "Jane Doe" while the old one
// sits in the trash would hit the constraint. So the slug is parked under a
// reserved prefix on the way in, and reclaimed on the way out.
//
// Partial unique indexes (`WHERE deleted_at IS NULL`) would be the tidier fix,
// but Prisma cannot declare them in the schema — it would take raw SQL in the
// migration, leaving the schema stating a constraint the database no longer
// enforces. A visible prefix beats an invisible divergence.
const TRASH_PREFIX = "__trash_";

/**
 * Park a unique value so the live namespace frees up. Idempotent.
 *
 * `id` is the row's primary key — an Int on most models, a cuid string on User
 * (Better Auth owns that table). It only has to make the marker unique, so both
 * are fine as long as the value round-trips.
 */
export function parkUniqueValue(value: string, id: number | string): string {
  if (isParkedValue(value)) return value;
  return `${TRASH_PREFIX}${id}__${value}`;
}

/**
 * Restore a parked value. Returns the original — callers must still check it
 * is free, since anything could have taken the slot while the row was away.
 */
export function unparkUniqueValue(value: string): string {
  // The id segment is `[^_]+` rather than `\d+` so cuid keys round-trip too.
  // Non-greedy would stop at the first `__` inside a cuid; anchoring on the
  // first `__` after a run of non-underscore characters keeps it unambiguous.
  const match = value.match(/^__trash_[^_]+__(.*)$/s);
  return match ? match[1] : value;
}

export function isParkedValue(value: string): boolean {
  return value.startsWith(TRASH_PREFIX);
}

/**
 * Drop a to-one relation whose row sits in the trash.
 *
 * Prisma accepts no `where` on a to-one `include`/`select`, so a trashed
 * category stays attached to a live talk and would keep rendering its coloured
 * badge on the public site. The query cannot filter it; the serializer can.
 * Select `deletedAt` on the relation and pass it through here.
 */
export function visibleCategory<T extends { deletedAt: Date | null }>(
  relation: T | null,
): Omit<T, "deletedAt"> | null {
  if (!relation || relation.deletedAt) return null;
  const { deletedAt: _deletedAt, ...rest } = relation;
  return rest;
}

/** Payload marking a row as trashed. */
export function softDeleteData(now: Date = new Date()) {
  return { deletedAt: now };
}

/** Payload bringing a row back out of the trash. */
export function restoreData() {
  return { deletedAt: null };
}
