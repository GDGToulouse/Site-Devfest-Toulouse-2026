import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getArticles, getEditions } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ArticleCard from "@/components/ArticleCard";
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
  searchParams: Promise<{ page?: string; edition?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("articles");
  const { page: pageParam, edition: editionParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  // ?edition=2025 filters the list down to that edition's articles (#178). The
  // year is what the URL carries — it is readable and stable — so it has to be
  // resolved to the edition id the API expects. An unknown year yields no
  // filter rather than an empty page.
  const editionYear = Number(editionParam) || null;
  const editions = editionYear ? await getEditions() : [];
  const edition = editionYear ? editions.find((e) => e.year === editionYear) ?? null : null;

  // 12 = 3 full rows of the 4-column grid (see grid-cols-4 below); 9 left a
  // trailing row of one item with three empty slots (#165).
  const { articles, totalPages } = await getArticles(page, 12, undefined, edition?.id);

  const heading = edition ? `${t("title")} — DevFest Toulouse ${edition.year}` : t("title");

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
              // Carry the edition filter across pages, otherwise page 2 would
              // silently drop back to every article.
              queryParams={edition ? { edition: String(edition.year) } : {}}
            />
          </>
        )}
      </div>
    </div>
  );
}
