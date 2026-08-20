const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// REVALIDATE_SECRET must be set in production. A soft fallback here would
// let anyone purge the Next.js cache by sending `secret: "dev-secret"` if
// the env var was ever forgotten. We fail closed: no secret configured ->
// revalidation is skipped silently in every environment, and an explicit
// warning is emitted so the misconfiguration is visible in logs.
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "";

if (!REVALIDATE_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[revalidate] REVALIDATE_SECRET not set — revalidation disabled.");
}

const LOCALES = ["fr", "en"] as const;

export async function revalidatePaths(paths: string[] = ["/"]): Promise<void> {
  if (!REVALIDATE_SECRET) return; // fail closed — see note above
  try {
    await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, paths }),
    });
  } catch {
    // Best-effort: don't fail the admin request if revalidation fails
  }
}

// Expand a locale-relative path template into one path per supported locale.
// Example: bilingualPaths("/actualites/:slug", { slug: "foo" })
//   -> ["/fr/actualites/foo", "/en/actualites/foo"]
function bilingualPaths(template: string): string[] {
  return LOCALES.map((l) => `/${l}${template}`);
}

export function revalidateHome(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    // The social preview image is a route of its own: without purging it, an
    // og:image changed in the admin would keep serving the previous one until
    // its cache expired (#183).
    ...bilingualPaths("/opengraph-image"),
  ]);
}

export function revalidateArticle(slug: string): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/actualites"),
    ...bilingualPaths(`/actualites/${slug}`),
  ]);
}

export function revalidateEdition(year: number): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths(`/editions/${year}`),
  ]);
}

/**
 * A venue changed (#105) — purge every page that prints it.
 *
 * `/lieu` had no purge at all until now: the practical-info page shipped with
 * #109 without one, so a corrected address stayed stale for an hour. The home
 * page carries the venue in its strap line, hence both.
 */
export function revalidateVenue(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/lieu"),
  ]);
}

export function revalidateBilletterie(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/billetterie"),
  ]);
}

export function revalidateSponsors(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/devenir-sponsor"),
    ...bilingualPaths("/sponsors"),
  ]);
}

// The partner job-offers recap page (#251).
export function revalidateJobOffers(): Promise<void> {
  return revalidatePaths([...bilingualPaths("/offres-emploi-partenaires")]);
}

export function revalidateSpeakers(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/speakers"),
    // The archive lists everyone, so it goes stale on any speaker change (#352).
    ...bilingualPaths("/hall-of-fame"),
  ]);
}

// One person's page (#352). Separate from revalidateSpeakers because there are
// ~240 of these: purging them all on every edit would be absurd, and never
// purging them means a speaker who fixes their bio from their magic link sees
// nothing change for an hour.
export function revalidateSpeaker(slug: string): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(`/speakers/${slug}`),
    // The OG image is its own route — same reason as the home page (#183).
    ...bilingualPaths(`/speakers/${slug}/opengraph-image`),
  ]);
}

export function revalidateConferences(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/conferences"),
  ]);
}

/**
 * One talk's own pages (#360).
 *
 * A talk is reachable by two URLs: the current-edition one, and the dated one a
 * past edition links to (#343). Both cache separately, so both have to go, or
 * an edit shows up on one page and not the other.
 *
 * Only the undated route carries an OG image — `editions/[year]/conferences`
 * has none.
 */
export function revalidateTalk(slug: string, year: number): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(`/conferences/${slug}`),
    ...bilingualPaths(`/conferences/${slug}/opengraph-image`),
    ...bilingualPaths(`/editions/${year}/conferences/${slug}`),
  ]);
}

/**
 * One sponsor's own page (#360). No OG image on this route, unlike speakers and
 * talks — nothing else to purge.
 */
export function revalidateSponsor(slug: string): Promise<void> {
  return revalidatePaths([...bilingualPaths(`/sponsors/${slug}`)]);
}

export function revalidateCfp(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/proposer-un-talk"),
  ]);
}

/**
 * Purge the whole Next cache (#358).
 *
 * For the bulk writes that happen outside the admin routes — the history import
 * touches editions, speakers, talks, categories and photos in one go. Listing
 * the affected paths would mean enumerating ~240 speaker pages plus every list,
 * and any omission silently serves stale content for an hour.
 *
 * Unlike the helpers above, this one *reports* instead of swallowing: a CLI
 * script has no user watching the logs, so it must be able to tell the operator
 * that a manual purge is still needed. The caller decides what to do with that —
 * an import that succeeded in the database must never be failed by a cache miss.
 */
export async function revalidateAll(): Promise<{ ok: boolean; reason?: string }> {
  if (!REVALIDATE_SECRET) {
    return { ok: false, reason: "REVALIDATE_SECRET absent" };
  }
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, all: true }),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
