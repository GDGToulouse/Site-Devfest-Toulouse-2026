// Numbers read from a public URL (#703). `Number()` alone lets through what an
// Int column refuses — "1.5", "Infinity", "1e10" — and Prisma then throws: a
// 500, and a 5xx alert (#118), for each address a crawler makes up.

// An edition year as it appears in an address: four digits, nothing else.
// The same rule as the frontend's `parseEditionYear`, which answers 404 before
// calling here.
export const YEAR_DIGITS = "[0-9]{4}";
export const YEAR_PATTERN = `^${YEAR_DIGITS}$`;

export const yearSchema = { type: "string", pattern: YEAR_PATTERN } as const;

/** `params` schema of a route under `/editions/:year`, plus its other segments. */
export function yearParamsSchema(extra: Record<string, { type: "string" }> = {}) {
  return {
    type: "object",
    required: ["year", ...Object.keys(extra)],
    properties: { year: yearSchema, ...extra },
  } as const;
}

// PostgreSQL `integer`: an id beyond it is refused by the query, not unmatched.
const MAX_INT4 = 2_147_483_647;

/**
 * A positive whole number from a query string, or `fallback`. For the list
 * controls a page sets in its own links (page, limit, edition id): a hand-edited
 * value degrades to the default instead of being refused.
 */
export function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_INT4 ? n : fallback;
}

