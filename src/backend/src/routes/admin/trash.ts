import type { FastifyInstance } from "fastify";

import { requireAdminRole } from "../../lib/admin-guard.js";
import { onlyDeleted, notDeleted, restoreData, unparkUniqueValue } from "../../lib/admin-helpers.js";
import { TRASH_ENTITIES, findTrashEntity, delegateFor } from "../../lib/trash-registry.js";
import { purgeFiles } from "../../lib/trash-files.js";

/**
 * The trash, backend side (#148): consult it, restore from it, empty it.
 *
 * One generic set of routes over the registry rather than thirty-six
 * hand-written handlers — see trash-registry.ts for what varies per entity.
 */

interface EntityParams {
  entity: string;
}
interface EntityIdParams extends EntityParams {
  id: string;
}

const entityParamSchema = {
  type: "object",
  required: ["entity"],
  properties: { entity: { type: "string" } },
} as const;

const entityIdParamSchema = {
  type: "object",
  required: ["entity", "id"],
  properties: { entity: { type: "string" }, id: { type: "string" } },
} as const;

// `id` is an Int everywhere except User, which Better Auth keys by cuid.
function coerceId(entityModel: string, raw: string): number | string | null {
  if (entityModel === "user") return raw.trim() || null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function adminTrashRoutes(app: FastifyInstance) {
  // GET /api/admin/trash — how many rows sit in the trash, per entity.
  app.get("/trash", async () => {
    const counts = await Promise.all(
      TRASH_ENTITIES.map(async (entity) => ({
        entity: entity.key,
        count: await delegateFor(entity).count({ where: onlyDeleted }),
      })),
    );
    return { entities: counts, total: counts.reduce((sum, c) => sum + c.count, 0) };
  });

  // GET /api/admin/trash/:entity — the trashed rows of one entity.
  app.get<{ Params: EntityParams }>("/trash/:entity", {
    schema: { params: entityParamSchema },
  }, async (request, reply) => {
    const entity = findTrashEntity(request.params.entity);
    if (!entity) return reply.code(404).send({ error: "Unknown trash entity" });

    const rows = await delegateFor(entity).findMany({
      where: onlyDeleted,
      orderBy: { deletedAt: "desc" },
    });

    return {
      entity: entity.key,
      items: rows.map((row) => {
        const raw = row[entity.labelField];
        const label = typeof raw === "string" ? unparkUniqueValue(raw) : String(raw ?? "");
        return {
          id: row.id,
          // Unparked for display: when the label field is itself parked (Tag
          // name, User email), the stored value carries the `__trash_<id>__`
          // marker — an implementation detail, not something to show an admin.
          label,
          deletedAt: row.deletedAt,
        };
      }),
    };
  });

  // POST /api/admin/trash/:entity/:id/restore
  app.post<{ Params: EntityIdParams }>("/trash/:entity/:id/restore", {
    schema: { params: entityIdParamSchema },
  }, async (request, reply) => {
    const entity = findTrashEntity(request.params.entity);
    if (!entity) return reply.code(404).send({ error: "Unknown trash entity" });

    const id = coerceId(entity.model, request.params.id);
    if (id === null) return reply.code(400).send({ error: "Invalid ID" });

    const delegate = delegateFor(entity);
    const row = await delegate.findFirst({ where: { id, ...onlyDeleted } });
    if (!row) return reply.code(404).send({ error: "Not found in trash" });

    // Unpark the unique values — and check each is actually free. Anything
    // could have taken the slug while the row sat in the trash; restoring
    // blindly would throw a raw Prisma unique-constraint error at the admin.
    const restored: Record<string, unknown> = { ...restoreData() };
    const conflicts: string[] = [];

    for (const field of entity.parkedFields) {
      const parked = row[field];
      if (typeof parked !== "string") continue;

      const original = unparkUniqueValue(parked);
      const taken = await delegate.findFirst({
        where: { [field]: original, id: { not: id }, ...notDeleted },
      });
      if (taken) conflicts.push(field);
      else restored[field] = original;
    }

    if (conflicts.length > 0) {
      return reply.code(409).send({
        error: "restore_conflict",
        // Named fields so the UI can say *what* clashes, not just that it does.
        fields: conflicts,
        message: `Impossible de restaurer : ${conflicts.join(", ")} déjà utilisé par un élément actif.`,
      });
    }

    await delegate.update({ where: { id }, data: restored });
    return { restored: true, id };
  });

  // DELETE /api/admin/trash/:entity/:id/purge — ADMIN only, irreversible.
  app.delete<{ Params: EntityIdParams }>("/trash/:entity/:id/purge", {
    preHandler: [requireAdminRole],
    schema: { params: entityIdParamSchema },
  }, async (request, reply) => {
    const entity = findTrashEntity(request.params.entity);
    if (!entity) return reply.code(404).send({ error: "Unknown trash entity" });

    const id = coerceId(entity.model, request.params.id);
    if (id === null) return reply.code(400).send({ error: "Invalid ID" });

    const delegate = delegateFor(entity);
    // Only ever purge from the trash: a row must be soft-deleted first, so a
    // stray call cannot destroy live data.
    const row = await delegate.findFirst({ where: { id, ...onlyDeleted } });
    if (!row) return reply.code(404).send({ error: "Not found in trash" });

    const fileUrls = entity.fileFields.map((f) => row[f] as string | null);

    await delegate.delete({ where: { id } });

    // After the row is gone, so the reference count no longer sees it. Files
    // still used elsewhere are kept — uploads are a shared library, not owned
    // by the row that happens to point at them.
    const files = await purgeFiles(fileUrls, { model: entity.model, id });

    return { purged: true, id, files };
  });
}

