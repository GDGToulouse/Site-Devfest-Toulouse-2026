/**
 * The edition year carried by an address (`/editions/[year]`, `?year=`), or
 * null when the segment is not one (#703).
 *
 * Four digits, nothing else — the rule the backend applies to the same
 * segment. `Number()` alone is not enough: "abc" became NaN, sent as
 * /api/editions/NaN, and the backend's 400 surfaced as a 500 page; "0x7E9" read
 * as 2025. A null here is a 404 decided without calling the backend.
 */
export function parseEditionYear(segment: string | undefined): number | null {
  return segment !== undefined && /^[0-9]{4}$/.test(segment) ? Number(segment) : null;
}
