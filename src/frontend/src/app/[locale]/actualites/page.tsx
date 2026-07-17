import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getArticles, getEditions, getTags } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ArticleCard from "@/components/ArticleCard";
import ArticlesFilters from "@/components/articles/ArticlesFilters";
import Pagination from "@/components/Pagination";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("articles");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/actualites`,
      languages: { fr: "/fr/actualites", en: "/en/actualites", "x-default": "/fr/actualites" },
    },
  };
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; edition?: string; tag?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("articles");
  const { page: pageParam, edition: editionParam, tag: tagParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  // Editions + tags feed the filter UI (#179); loaded unconditionally so the
  // controls are always available, not only when a filter is already active.
  const [editions, tags] = await Promise.all([getEditions(), getTags()]);

  // ?edition=2025 filters the list down to that edition's articles (#178). The
  // year is what the URL carries — it is readable and stable — so it has to be
  // resolved to the edition id the API expects. An unknown year yields no
  // filter rather than an empty page.
  const editionYear = Number(editionParam) || null;
  const edition = editionYear ? editions.find((e) => e.year === editionYear) ?? null : null;
  // Only keep a tag that actually exists, so a stale/invalid slug degrades to
  // "no tag filter" instead of an empty page.
  const activeTag = tagParam && tags.some((tg) => tg.slug === tagParam) ? tagParam : null;

  // 12 = 3 full rows of the 4-column grid (see grid-cols-4 below); 9 left a
  // trailing row of one item with three empty slots (#165).
  const { articles, totalPages } = await getArticles(page, 12, activeTag ?? undefined, edition?.id);

  const heading = edition ? `${t("title")} — DevFest Toulouse ${edition.year}` : t("title");

  const filterQuery: Record<string, string> = {};
  if (edition) filterQuery.edition = String(edition.year);
  if (activeTag) filterQuery.tag = activeTag;

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/actualites` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-5xl font-bold text-noir">
          {heading}
        </h1>

        <ArticlesFilters
          editions={editions.map((e) => ({ year: e.year, label: `DevFest Toulouse ${e.year}` }))}
          tags={tags}
          activeEdition={edition?.year ?? null}
          activeTag={activeTag}
          labels={{
            edition: t("filters.edition"),
            allEditions: t("filters.allEditions"),
            tags: t("filters.tags"),
            reset: t("filters.reset"),
          }}
        />

        {articles.length === 0 ? (
          <p className="mt-8 text-gris text-lg">{t("noArticles")}</p>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} locale={locale} />
              ))}
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/actualites"
              // Carry the active filters across pages, otherwise page 2 would
              // silently drop back to every article.
              queryParams={filterQuery}
            />
          </>
        )}
      </div>
    </div>
  );
}
