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
 */
export async function pageMetadata(
  locale: string,
  path: string,
  openGraph: NonNullable<Metadata["openGraph"]> = {},
): Promise<Pick<Metadata, "alternates" | "openGraph">> {
  const t = await getTranslations({ locale, namespace: "site" });
  const url = `/${locale}${path}`;

  return {
    alternates: {
      canonical: url,
      languages: { fr: `/fr${path}`, en: `/en${path}`, "x-default": `/fr${path}` },
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
