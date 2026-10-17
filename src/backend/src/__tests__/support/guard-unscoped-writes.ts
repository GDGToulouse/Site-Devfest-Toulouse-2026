import { Prisma } from "../../generated/prisma/client.js";

// A test cleanup like `prisma.talk.deleteMany({ where: { editionId } })` runs in
// an `afterAll`, even when the `beforeAll` that creates the edition threw. With
// `editionId` still `undefined`, Prisma drops the key and the filter becomes
// `{}`: every talk of the shared test database is deleted, and the demo data
// every other suite reads is gone (#681).
//
// This extension, loaded for every test file (`setup-prisma-guard.ts`), refuses
// such a write before it reaches the database. It only guards the two bulk
// writes, whose filter may legitimately match many rows and so can never fail
// on its own.

type Json = unknown;

/** True when `value` holds an `undefined` anywhere, which Prisma reads as "no filter". */
function hasUndefined(value: Json): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value instanceof Date || value === null || typeof value !== "object") return false;
  return Object.values(value as Record<string, Json>).some(hasUndefined);
}

export function assertScoped(model: string, operation: string, where: Json): void {
  const empty = !where || (typeof where === "object" && Object.keys(where as object).length === 0);
  if (empty) throw new Error(`${model}.${operation} without a filter would touch every row`);
  if (hasUndefined(where)) {
    throw new Error(`${model}.${operation} has an undefined value in its filter: Prisma would drop it and touch more rows than meant`);
  }
}

export const guardUnscopedWrites = Prisma.defineExtension({
  name: "guard-unscoped-writes",
  query: {
    $allModels: {
      async deleteMany({ model, args, query }) {
        assertScoped(model, "deleteMany", args?.where);
        return query(args);
      },
      async updateMany({ model, args, query }) {
        assertScoped(model, "updateMany", args?.where);
        return query(args);
      },
    },
  },
});
