import type { MetadataRoute } from "next";
import {
  getArticles,
  getContentPage,
  getPublishedPages,
  getCurrentEdition,
  getEditions,
  getEditionTalks,
  getHallOfFame,
  getIndexableSponsors,
} from "@/lib/api";
import { canonicalLocaleFor } from "@/lib/seo";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Rendered per request, never prerendered (#426). `next build` runs with no
// backend reachable — `fetchAPI` degrades to null there by design — so a
// build-time render lists the static routes and nothing else. That empty
// sitemap is then served to whoever asks first after a deployment, and stays
// served until some request happens to trigger a revalidation: observed on
// beta, 28 URLs for more than a day where a fresh render gives 1310. Measured
// on a build made without a backend: 28 URLs prerendered, 122 rendered.
//
// The cost is one render per request, on a URL crawlers fetch a few times a
// day — and the fetches keep their own hour-long cache, so a backend outage
// serves the last good sitemap rather than a truncated one. Only a cold cache
// and a dead backend together produce a 500, which a crawler retries; a 200
// announcing a site with no content is what it would never question (#345).
export const dynamic = "force-dynamic";

type Locale = "fr" | "en";

// Articles are read page by page rather than with a fixed ceiling: a hard
// `limit` silently drops everything past it, and a sitemap that quietly stops
// listing content is the kind of bug nobody notices (#379).
const ARTICLES_PER_PAGE = 100;
const MAX_ARTICLE_PAGES = 50;

async function getAllArticles() {
  const first = await getArticles(1, ARTICLES_PER_PAGE);
  const all = [...first.articles];
  const pages = Math.min(first.totalPages, MAX_ARTICLE_PAGES);
  for (let page = 2; page <= pages; page++) {
    const next = await getArticles(page, ARTICLES_PER_PAGE);
    all.push(...next.articles);
  }
  return all;
}

// `lastmod` must reflect a real modification. Sending `new Date()` claims every
// page changed at the instant of the crawl, every crawl — a signal that is
// always true tells a crawler nothing, so it gets discounted (#379).
function toDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

// Routes backed by CMS content that may not be translated yet. We skip the
// /en entry when the EN content is empty to avoid indexing a FR-only page
// under the /en URL (which Google treats as low-quality duplicate).
const CMS_BACKED_ROUTES = [
  { path: "/code-de-conduite", slug: "code-de-conduite" },
  { path: "/mentions-legales", slug: "mentions-legales" },
] as const;

async function getCmsRouteMeta(slug: string): Promise<{ locales: Locale[]; lastModified: Date | undefined }> {
  const page = await getContentPage(slug);
  if (!page) return { locales: ["fr"], lastModified: undefined };
  const locales: Locale[] =
    page.titleEn.trim() && page.contentEn.trim() ? ["fr", "en"] : ["fr"];
  return { locales, lastModified: toDate(page.updatedAt) };
}

function buildEntry(
  url: string,
  locales: Locale[],
  path: string,
  // Omitted rather than faked when the entity carries no date: no `lastmod` at
  // all is honest, a wrong one is worse than none.
  lastModified: Date | undefined,
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
    "/replays",
    "/speakers",
    "/hall-of-fame",
    "/sponsors",
    "/proposer-un-talk",
    "/contact",
    "/devenir-sponsor",
    // Were missing while they carry full metadata and sit in the navigation.
    "/editions",
    "/offres-emploi-partenaires",
  ];

  const featured = await getCurrentEdition();

  // /lieu is conditional, not static: the page itself calls notFound() when the
  // edition has no venue info, and the nav entry is hidden the same way. Listing
  // it unconditionally would put a 404 in the sitemap.
  if (featured?.hasVenueInfo) fullyTranslatedRoutes.push("/lieu");

  // /programme renders a "coming soon" card rather than 404ing before the grid
  // is placed (#106), so listing it early would only index an empty page.
  if (featured?.isScheduleReady) fullyTranslatedRoutes.push("/programme");

  const entries: MetadataRoute.Sitemap = [];

  // Routes available in both locales. These are code-backed pages with no row
  // behind them, so there is no modification date to report — the index pages
  // change whenever their content does, which `changeFrequency` already says.
  for (const locale of ["fr", "en"] as Locale[]) {
    for (const route of fullyTranslatedRoutes) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${route}`,
          ["fr", "en"],
          route,
          undefined,
          route === "" ? "weekly" : "monthly",
          route === "" ? 1.0 : 0.7,
        ),
      );
    }
  }

  // CMS-backed routes (legal pages): gate /en entry on EN content presence
  for (const { path, slug } of CMS_BACKED_ROUTES) {
    const { locales, lastModified } = await getCmsRouteMeta(slug);
    for (const locale of locales) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          locales,
          path,
          lastModified,
          "monthly",
          0.4,
        ),
      );
    }
  }

  // Pages created from the admin, served by the [locale]/[slug] segment (#421).
  // Only published ones are listed — a draft is a 404 (#419). The two routes
  // above have their own path and are excluded here to avoid a duplicate entry.
  const cmsSlugs = new Set<string>(CMS_BACKED_ROUTES.map((r) => r.slug));
  for (const page of await getPublishedPages()) {
    if (cmsSlugs.has(page.slug)) continue;
    const path = `/${page.slug}`;
    const locales: Locale[] = page.hasEnglish ? ["fr", "en"] : ["fr"];
    for (const locale of locales) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          locales,
          path,
          toDate(page.updatedAt),
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
          toDate(edition.updatedAt),
          "yearly",
          0.5,
        ),
      );
    }
  }

  // Talk pages, the largest body of unique content on the site and until now
  // absent entirely (#379). Two route families, because a talk of the featured
  // edition and an archived one are served by different pages:
  //
  //   /conferences/{slug}                    → featured edition only
  //   /editions/{year}/conferences/{slug}    → any other year
  //
  // Listing a past talk under /conferences/{slug} would emit a 404: that route
  // resolves against the featured edition alone.
  //
  // One entry per talk, in the talk's own language (#468). Listing both locales
  // offered Google two URLs carrying the same untranslated words — nine of them
  // came back as "Google n'a pas choisi la même URL canonique que vous", and it
  // had chosen correctly. The page still answers in either locale; only the
  // canonical, the hreflang and this list name one.
  for (const edition of editions) {
    const isFeatured = featured?.year === edition.year;
    const talks = await getEditionTalks(edition.year);
    for (const talk of talks) {
      const path = isFeatured
        ? `/conferences/${talk.slug}`
        : `/editions/${edition.year}/conferences/${talk.slug}`;
      const locale = canonicalLocaleFor(talk.language) ?? "fr";
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: toDate(talk.updatedAt),
        changeFrequency: isFeatured ? "monthly" : "yearly",
        priority: isFeatured ? 0.7 : 0.4,
        // No `alternates`: an hreflang naming a URL that canonicalises
        // elsewhere is the contradiction this change exists to remove.
      });
    }
  }

  // Sponsor pages, across every edition — not the featured wall. A company that
  // sponsored a past year but not the current one has no entry on the wall and
  // yet its page answers 200, so reading /api/sponsors here would silently omit
  // exactly the historical sponsors #370 made visible.
  const sponsors = await getIndexableSponsors();
  for (const sponsor of sponsors) {
    const path = `/sponsors/${sponsor.slug}`;
    for (const locale of ["fr", "en"] as Locale[]) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          ["fr", "en"],
          path,
          toDate(sponsor.updatedAt),
          "monthly",
          0.5,
        ),
      );
    }
  }

  // Every speaker who ever spoke (#352). Reading the same endpoint as the hall
  // of fame page means the two can never list different people. Bilingual with
  // no gating: the page falls back to the FR bio when there is no EN one, so it
  // is structurally translated either way.
  const speakers = await getHallOfFame();
  for (const person of speakers) {
    const path = `/speakers/${person.slug}`;
    for (const locale of ["fr", "en"] as Locale[]) {
      entries.push(
        buildEntry(
          `${BASE_URL}/${locale}${path}`,
          ["fr", "en"],
          path,
          undefined,
          "yearly",
          0.5,
        ),
      );
    }
  }

  // Dynamic article pages — gate /en on titleEn presence
  const articles = await getAllArticles();
  for (const article of articles) {
    const path = `/actualites/${article.slug}`;
    const locales: Locale[] = article.titleEn.trim() ? ["fr", "en"] : ["fr"];
    const lastModified = toDate(article.publishedAt);
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
