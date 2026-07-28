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

export function revalidateCfp(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/proposer-un-talk"),
  ]);
}
