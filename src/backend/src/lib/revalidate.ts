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
  return revalidatePaths(bilingualPaths(""));
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
  ]);
}

export function revalidateCfp(): Promise<void> {
  return revalidatePaths([
    ...bilingualPaths(""),
    ...bilingualPaths("/proposer-un-talk"),
  ]);
}
