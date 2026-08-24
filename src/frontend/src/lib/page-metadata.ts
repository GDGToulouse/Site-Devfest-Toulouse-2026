import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * The `alternates` and `openGraph` blocks of one public page (#384).
 *
 * Two findings forced a single builder rather than the per-page literals this
 * replaces:
 *
 * - `openGraph` is *replaced* by the deepest segment that declares it, never
 *   merged. A page that set only `{ title, description }` therefore dropped the
 *   `og:site_name`, `og:locale` and `og:type` of the layout — verified on
 *   `/fr/conferences/…`, which carried none of the three.
 * - `og:url` has to be the page's own URL, so it cannot be declared once in the
 *   layout: every page would then announce `/fr`.
 *
 * `og:title` and `og:description` are deliberately absent: Next fills them from
 * the page's own `title` and `description`, so restating them here would be one
 * more pair of values to keep in step.
 *
 * @param path page path *without* the locale prefix — `""` for the home page.
 * @param openGraph what this page adds or overrides, e.g. `type: "article"`.
 * @param onlyLocale the single locale this page exists in — see below.
 */
export async function pageMetadata(
  locale: string,
  path: string,
  openGraph: NonNullable<Metadata["openGraph"]> = {},
  onlyLocale?: string,
): Promise<Pick<Metadata, "alternates" | "openGraph">> {
  const t = await getTranslations({ locale, namespace: "site" });

  // A talk exists in one language and is not translated (#293), so both URLs
  // served the same French words. Search Console reported nine of them as
  // "Google n'a pas choisi la même URL canonique que vous", and it was right
  // (#468). The page stays reachable in either locale — the chrome around the
  // abstract is translated, and the language switch has to keep working — but
  // it points at one canonical, and declares hreflang for that one language
  // only. Declaring the other variant would name a URL that canonicalises
  // elsewhere, which is the contradiction Google already resolved on its own.
  const canonicalLocale = onlyLocale ?? locale;
  const url = `/${canonicalLocale}${path}`;
  const languages = onlyLocale
    ? { [onlyLocale]: url, "x-default": url }
    : { fr: `/fr${path}`, en: `/en${path}`, "x-default": `/fr${path}` };

  return {
    alternates: {
      canonical: url,
      languages,
    },
    openGraph: {
      siteName: t("title"),
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url,
      ...openGraph,
    },
  };
}
