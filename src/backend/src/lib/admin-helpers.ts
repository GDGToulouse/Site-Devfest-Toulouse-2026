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
