/**
 * Headers for the frontend server's own calls to the backend (#689).
 *
 * The backend exempts a request carrying `INTERNAL_API_SECRET` from its
 * per-IP rate limit: SSR calls have no visitor address and all share one
 * bucket, which a traffic spike on uncached pages drained (429 for everyone).
 *
 * Only for `fetch` calls made by the Node server (pages, route handlers,
 * `lib/*`). The variable is read at call time, is not `NEXT_PUBLIC_*`, and
 * must never be put in a component that ships to the browser, nor forwarded
 * from a visitor's request. Unset or empty: no header, the backend then limits
 * these calls like any other.
 */
export function internalApiHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  return secret ? { "x-internal-api-secret": secret } : {};
}
