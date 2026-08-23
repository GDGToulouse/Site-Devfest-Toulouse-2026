import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getArticles, getTags } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import ArticleCard from "@/components/ArticleCard";
import Pagination from "@/components/Pagination";

/**
 * The tag as it is written, not as it is addressed (#381).
 *
 * The page used the slug everywhere — title, heading, breadcrumb — so a reader
 * landing from a search result read "Articles tagués cloud-native" where the
 * site says "Cloud Native" everywhere else. The list is a handful of rows, so
 * resolving the label costs one cached call.
 */
async function findTag(slug: string) {
  return (await getTags()).find((tag) => tag.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("articles");
  const tag = await findTag(slug);

  // No such tag — the page below answers 404, so there is nothing to describe.
  if (!tag) return { title: t("taggedWith") };

  return {
    title: `${t("taggedWith")} ${tag.name}`,
    // The only page on the site that had a title and no description (#381).
    description: t("tagDescription", { tag: tag.name }),
    ...(await pageMetadata(locale, `/actualites/tag/${slug}`)),
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

  const [tag, { articles, totalPages }] = await Promise.all([
    findTag(slug),
    getArticles(page, 9, slug),
  ]);

  // An address that names no tag is a 404, not an empty list: the page used to
  // answer 200 with "aucun article", which reads to a crawler as a real page
  // (#466 was the same defect on the sponsor space).
  if (!tag) notFound();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/actualites` },
    { label: tag.name, href: `/${locale}/actualites/tag/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-5xl font-bold text-noir">
          {t("taggedWith")} <span className="text-malachite">{tag.name}</span>
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
