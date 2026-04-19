import type { MetadataRoute } from "next";
import { getArticles, getContentPage, getEditions } from "@/lib/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

type Locale = "fr" | "en";

// Routes backed by CMS content that may not be translated yet. We skip the
// /en entry when the EN content is empty to avoid indexing a FR-only page
// under the /en URL (which Google treats as low-quality duplicate).
const CMS_BACKED_ROUTES = [
  { path: "/code-de-conduite", slug: "code-de-conduite" },
  { path: "/mentions-legales", slug: "mentions-legales" },
] as const;

async function getLocalesWithEnContent(slug: string): Promise<Locale[]> {
  const page = await getContentPage(slug);
  if (!page) return ["fr"];
  return page.titleEn.trim() && page.contentEn.trim()
    ? ["fr", "en"]
    : ["fr"];
}

function buildEntry(
  url: string,
  locales: Locale[],
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${BASE_URL}/${l}${path}`;
  languages["x-default"] = `${BASE_URL}/fr${path}`;
  return { url, lastModified, changeFrequency, priority, alternates: { languages } };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fullyTranslatedRoutes = [
    "",
    "/actualites",
    "/billetterie",
    "/conferences",
    "/speakers",
    "/partners",
    "/proposer-un-talk",
    "/contact",
    "/devenir-sponsor",
  ];
  const entries: MetadataRoute.Sitemap = [];

  // Routes available in both locales
  for (const locale of ["fr", "en"] as Locale[]) {
    for (const route of fullyTranslatedRoutes) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${route}`,
          ["fr", "en"],
          route,
          new Date(),
          route === "" ? "weekly" : "monthly",
          route === "" ? 1.0 : 0.7,
        ),
      );
    }
  }

  // CMS-backed routes (legal pages): gate /en entry on EN content presence
  for (const { path, slug } of CMS_BACKED_ROUTES) {
    const locales = await getLocalesWithEnContent(slug);
    for (const locale of locales) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          locales,
          path,
          new Date(),
          "monthly",
          0.4,
        ),
      );
    }
  }

  // Dynamic edition bilan pages
  const editions = await getEditions();
  for (const edition of editions) {
    const path = `/editions/${edition.year}`;
    for (const locale of ["fr", "en"] as Locale[]) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          ["fr", "en"],
          path,
          new Date(),
          "yearly",
          0.5,
        ),
      );
    }
  }

  // Dynamic article pages — gate /en on titleEn presence
  const { articles } = await getArticles(1, 100);
  for (const article of articles) {
    const path = `/actualites/${article.slug}`;
    const locales: Locale[] = article.titleEn.trim() ? ["fr", "en"] : ["fr"];
    const lastModified = article.publishedAt
      ? new Date(article.publishedAt)
      : new Date();
    for (const locale of locales) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          locales,
          path,
          lastModified,
          "monthly",
          0.6,
        ),
      );
    }
  }

  return entries;
}
