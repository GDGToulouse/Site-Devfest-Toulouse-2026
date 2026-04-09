import type { MetadataRoute } from "next";
import { getArticles, getEditions } from "@/lib/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ["fr", "en"];
  const staticRoutes = ["", "/actualites", "/billetterie", "/contact", "/devenir-sponsor", "/code-de-conduite", "/mentions-legales"];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const route of staticRoutes) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? "weekly" : "monthly",
        priority: route === "" ? 1.0 : 0.7,
        alternates: {
          languages: {
            fr: `${BASE_URL}/fr${route}`,
            en: `${BASE_URL}/en${route}`,
          },
        },
      });
    }
  }

  // Dynamic edition bilan pages
  const editions = await getEditions();
  for (const edition of editions) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}/editions/${edition.year}`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.5,
        alternates: {
          languages: {
            fr: `${BASE_URL}/fr/editions/${edition.year}`,
            en: `${BASE_URL}/en/editions/${edition.year}`,
          },
        },
      });
    }
  }

  // Dynamic article pages
  const { articles } = await getArticles(1, 100);
  for (const article of articles) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}/actualites/${article.slug}`,
        lastModified: article.publishedAt ? new Date(article.publishedAt) : new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: {
            fr: `${BASE_URL}/fr/actualites/${article.slug}`,
            en: `${BASE_URL}/en/actualites/${article.slug}`,
          },
        },
      });
    }
  }

  return entries;
}
