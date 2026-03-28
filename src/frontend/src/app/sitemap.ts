import type { MetadataRoute } from "next";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["fr", "en"];
  const staticRoutes = ["", "/actualites", "/billetterie", "/contact", "/code-de-conduite", "/mentions-legales"];

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

  return entries;
}
