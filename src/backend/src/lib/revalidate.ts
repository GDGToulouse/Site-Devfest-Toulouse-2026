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

// One tag's article listing (#376): renaming, merging or trashing a tag
// changes what it lists, or takes the page away.
export function revalidateTagPage(slug: string): Promise<void> {
  return revalidatePaths([...bilingualPaths(`/actualites/tag/${slug}`)]);
}

/**
 * A content page was saved, published, unpublished or trashed (#419).
 *
 * Public pages sit behind `s-maxage=3600`, so without this purge a page
 * published in the admin would stay a 404 for up to an hour — and, worse, one
 * taken back to draft would keep being served just as long. The header and
 * footer carry the navigation, so every page is purged, not just this one.
 */
export function revalidateContentPage(slug: string): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths(`/${slug}`),
    // The sitemap is the whole point of publishing: leaving it stale would list
    // a page that 404s, or hide one that is live. It has no locale prefix.
    "/sitemap.xml",
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
    // Renaming a room changes the grid's column headers (#106).
    ...bilingualPaths("/programme"),
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
export function speakerPagePaths(slug: string): string[] {
  return [
    ...bilingualPaths(`/speakers/${slug}`),
    // The OG image is its own route — same reason as the home page (#183).
    ...bilingualPaths(`/speakers/${slug}/opengraph-image`),
  ];
}

export function revalidateSpeaker(slug: string): Promise<void> {
  return revalidatePaths(speakerPagePaths(slug));
}

export function conferenceListPaths(): string[] {
  return [
    ...bilingualPaths(""),
    ...bilingualPaths("/conferences"),
    // The grid (#106) reads the same talks, plus the off-session entries the
    // schedule screens write. Placing a session must show there immediately —
    // the organisers publish the planning right up to the day before.
    ...bilingualPaths("/programme"),
    // Replays list talks with a video and their speakers (#102): a replay added,
    // a talk unpublished or a speaker renamed shows there too (#636).
    ...bilingualPaths("/replays"),
  ];
}

export function revalidateConferences(): Promise<void> {
  return revalidatePaths(conferenceListPaths());
}

/** One year's archive page, which lists its talks and speakers (#63). */
export function editionPagePaths(year: number): string[] {
  return bilingualPaths(`/editions/${year}`);
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
export function talkPagePaths(slug: string, year: number): string[] {
  return [
    ...bilingualPaths(`/conferences/${slug}`),
    ...bilingualPaths(`/conferences/${slug}/opengraph-image`),
    ...bilingualPaths(`/editions/${year}/conferences/${slug}`),
  ];
}

export function revalidateTalk(slug: string, year: number): Promise<void> {
  return revalidatePaths(talkPagePaths(slug, year));
}

/**
 * One sponsor's own page (#360). No OG image on this route, unlike speakers and
 * talks — nothing else to purge.
 */
export function sponsorPagePaths(slug: string): string[] {
  return bilingualPaths(`/sponsors/${slug}`);
}

/** Every company with each year's tier (#611), purged when a tier changes. */
export function sponsorHallOfFamePaths(): string[] {
  return bilingualPaths("/sponsors/hall-of-fame");
}

export function revalidateSponsor(slug: string): Promise<void> {
  return revalidatePaths(sponsorPagePaths(slug));
}

/**
 * Every page a job offer shows on: the sponsor's own page, the recap page, and
 * the lists whose menu depends on there being offers. Purging the lists alone
 * left a created, edited or restored offer missing from the sponsor's page for
 * an hour (#609).
 */
export async function revalidateJobOfferPages(sponsorSlug: string): Promise<void> {
  await Promise.all([revalidateSponsors(), revalidateSponsor(sponsorSlug), revalidateJobOffers()]);
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
