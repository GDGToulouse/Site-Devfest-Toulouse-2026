import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getArticles } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ArticleCard from "@/components/ArticleCard";
import Pagination from "@/components/Pagination";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("articles");
  return {
    title: `${t("taggedWith")} ${slug}`,
    alternates: {
      canonical: `/${locale}/actualites/tag/${slug}`,
      languages: { fr: `/fr/actualites/tag/${slug}`, en: `/en/actualites/tag/${slug}` },
    },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("articles");
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  const { articles, totalPages } = await getArticles(page, 8, slug);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/actualites` },
    { label: slug, href: `/${locale}/actualites/tag/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-5xl font-bold text-noir">
          {t("taggedWith")} <span className="text-malachite">{slug}</span>
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
              basePath={`/actualites/tag/${slug}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
