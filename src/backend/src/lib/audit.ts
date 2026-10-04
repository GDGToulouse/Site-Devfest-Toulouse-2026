import type { AuditAction, Prisma, PrismaClient } from "../generated/prisma/client.js";
import { getRequestContext } from "./request-context.js";

// Every write to a tracked model leaves an AuditLog row (#513). Done here, on the
// shared client, rather than in each route: a route that forgot to log would be
// an invisible change, and "who changed this?" must always have an answer.
//
// Known limit (Prisma, issue 20678): the reads and the log write below go
// through the base client, so inside a transaction they run on another
// connection. A rolled-back transaction can therefore leave a log line for a
// write that never landed. The only transaction in the codebase is the featured
// speakers rotation, which does not roll back in practice.

// Not content: sessions, credentials and one-time tokens churn on every
// sign-in, and logging them would bury the edits people look for — or store
// secrets. AuditLog itself is excluded, or each write would log its own log.
const EXCLUDED_MODELS = new Set(["AuditLog", "Session", "Account", "Verification", "TranslationLog"]);

// A field whose change alone is bookkeeping, not an edit.
const NOISE_ONLY_FIELDS: Record<string, readonly string[]> = {
  // Refreshed on API key use (auth-context.ts): one line per minute per key.
  ApiKey: ["lastUsedAt"],
};

// Set by Prisma on every write: never the change anyone asked for.
const IGNORED_FIELDS = new Set(["createdAt", "updatedAt"]);

// The history is read by admins, but it is still a copy: a token stored here
// would be a second, longer-lived place to steal it from.
const SECRET_FIELDS = new Set([
  "password",
  "editToken",
  "invitationToken",
  "hashedKey",
  "accessToken",
  "refreshToken",
  "idToken",
  "token",
]);
const MASKED = "masqué";

const PRIMARY_KEY: Record<string, string> = { FileMetadata: "filename" };

// A bulk write past this many rows logs one summary line instead of one line
// per row. Real bulk writes here touch a few dozen rows (the featured rotation,
// a programme reorder); the guard only stops an unbounded where from loading a
// whole table into memory.
const BULK_DETAIL_LIMIT = 5000;

type Row = Record<string, unknown>;
export type Changes = Record<string, { before: unknown; after: unknown }>;

interface Delegate {
  findUnique(args: unknown): Promise<Row | null>;
  findMany(args: unknown): Promise<Row[]>;
  createManyAndReturn(args: unknown): Promise<Row[]>;
}

interface Entry {
  action: AuditAction;
  entity: string;
  entityId: string;
  changes: Changes | null;
}

function delegateOf(client: PrismaClient, model: string): Delegate {
  return (client as unknown as Record<string, Delegate>)[model.charAt(0).toLowerCase() + model.slice(1)];
}

// Comparable, JSON-safe form: Dates as ISO strings, the rest as-is.
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function mask(value: unknown): unknown {
  return value === null ? null : MASKED;
}

/** Field-level difference between two states of a record, secrets masked. */
export function diffRows(model: string, before: Row | null, after: Row | null): Changes {
  const changes: Changes = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const b = normalize(before?.[key]);
    const a = normalize(after?.[key]);
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    changes[key] = SECRET_FIELDS.has(key) ? { before: mask(b), after: mask(a) } : { before: b, after: a };
  }

  const noise = NOISE_ONLY_FIELDS[model];
  if (noise && Object.keys(changes).every((key) => noise.includes(key))) return {};
  return changes;
}

function actionFor(before: Row | null, after: Row | null): AuditAction {
  if (!before) return "CREATE";
  if (!after) return "DELETE";
  if ("deletedAt" in before) {
    if (before.deletedAt == null && after.deletedAt != null) return "TRASH";
    if (before.deletedAt != null && after.deletedAt == null) return "RESTORE";
  }
  return "UPDATE";
}

function entryFor(model: string, pk: string, before: Row | null, after: Row | null): Entry | null {
  const changes = diffRows(model, before, after);
  if (Object.keys(changes).length === 0) return null;
  return {
    action: actionFor(before, after),
    entity: model,
    entityId: String((after ?? before)?.[pk]),
    changes,
  };
}

async function writeEntries(base: PrismaClient, entries: Array<Entry | null>): Promise<void> {
  const kept = entries.filter((e): e is Entry => e !== null);
  if (kept.length === 0) return;

  const context = getRequestContext();
  // No context at all means a script or a test calling the library directly;
  // a context without an actor is a visitor or a link nobody resolved.
  const actorLabel = context?.actor?.label ?? (context ? "Anonyme" : "Système");
  try {
    await base.auditLog.createMany({
      data: kept.map((entry) => ({
        ...entry,
        // Values come from normalize(): JSON-safe by construction.
        changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
        channel: context?.channel ?? "SYSTEM",
        actorUserId: context?.actor?.userId ?? null,
        actorLabel,
        apiKeyId: context?.apiKeyId ?? null,
        ip: context?.ip ?? null,
      })),
    });
  } catch (err) {
    // The edit itself succeeded: failing it now because its trace could not be
    // written would lose the change and keep nothing. Say so loudly instead.
    console.error("[audit] could not record", kept.length, "entries for", kept[0].entity, err);
  }
}

// A narrowed `select` may leave the primary key out, and the record cannot be
// found again without it. Ask for it, and hide it again if the caller did not.
function withPrimaryKey(args: Row, pk: string): { args: Row; added: boolean } {
  const select = args.select as Row | undefined;
  if (!select || select[pk]) return { args, added: false };
  return { args: { ...args, select: { ...select, [pk]: true } }, added: true };
}

function stripPrimaryKey(result: unknown, pk: string, added: boolean): unknown {
  if (!added || !result || typeof result !== "object") return result;
  const { [pk]: _, ...rest } = result as Row;
  return rest;
}

/** The shared client, with every write recorded in AuditLog. */
export function withAudit(base: PrismaClient) {
  return base.$extends({
    name: "audit",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (EXCLUDED_MODELS.has(model)) return query(args);

          const delegate = delegateOf(base, model);
          const pk = PRIMARY_KEY[model] ?? "id";
          const input = args as Row;
          const byId = (id: unknown) => delegate.findUnique({ where: { [pk]: id } });

          switch (operation) {
            case "create": {
              const { args: withPk, added } = withPrimaryKey(input, pk);
              const result = (await query(withPk)) as Row;
              await writeEntries(base, [entryFor(model, pk, null, await byId(result[pk]))]);
              return stripPrimaryKey(result, pk, added);
            }

            case "update":
            case "upsert": {
              const before = await delegate.findUnique({ where: input.where });
              const { args: withPk, added } = withPrimaryKey(input, pk);
              const result = (await query(withPk)) as Row;
              const after = await byId(before?.[pk] ?? result[pk]);
              await writeEntries(base, [entryFor(model, pk, before, after)]);
              return stripPrimaryKey(result, pk, added);
            }

            case "delete": {
              const before = await delegate.findUnique({ where: input.where });
              const result = await query(args);
              await writeEntries(base, [entryFor(model, pk, before, null)]);
              return result;
            }

            case "updateMany":
            case "deleteMany": {
              const befores = await delegate.findMany({ where: input.where, take: BULK_DETAIL_LIMIT + 1 });
              const result = await query(args);
              if (befores.length > BULK_DETAIL_LIMIT) {
                await writeEntries(base, [
                  {
                    action: operation === "deleteMany" ? "DELETE" : "UPDATE",
                    entity: model,
                    entityId: "*",
                    changes: { count: { before: null, after: (result as { count: number }).count } },
                  },
                ]);
                return result;
              }
              if (operation === "deleteMany") {
                await writeEntries(base, befores.map((before) => entryFor(model, pk, before, null)));
                return result;
              }
              const afters = await delegate.findMany({ where: { [pk]: { in: befores.map((b) => b[pk]) } } });
              const afterById = new Map(afters.map((a) => [a[pk], a]));
              await writeEntries(
                base,
                befores.map((before) => entryFor(model, pk, before, afterById.get(before[pk]) ?? null)),
              );
              return result;
            }

            case "createMany": {
              // createMany returns a count, which names nothing: the ids only come
              // back from createManyAndReturn, run here in its place.
              const rows = await delegate.createManyAndReturn(args);
              await writeEntries(base, rows.map((row) => entryFor(model, pk, null, row)));
              return { count: rows.length };
            }

            default:
              // Reads, and the *AndReturn bulk variants nothing in the codebase
              // calls. Using one would need a case here first.
              return query(args);
          }
        },
      },
    },
  });
}
