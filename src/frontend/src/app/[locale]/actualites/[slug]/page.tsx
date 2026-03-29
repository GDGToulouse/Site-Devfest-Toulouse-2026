import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { getArticleBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const article = await getArticleBySlug(slug);

  if (!article) return { title: "Article not found" };

  const title = localizedField(article, "title", locale);
  const description = localizedField(article, "excerpt", locale) || title;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/actualites/${slug}`,
      languages: { fr: `/fr/actualites/${slug}`, en: `/en/actualites/${slug}` },
    },
    openGraph: {
      title,
      description,
      type: "article",
      ...(article.imageUrl ? { images: [{ url: article.imageUrl }] } : {}),
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("articles");
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  const title = localizedField(article, "title", locale);
  const content = localizedField(article, "content", locale);
  const publishedAt = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(
        locale === "en" ? "en-GB" : "fr-FR",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : "";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    ...(article.excerptFr || article.excerptEn
      ? { description: localizedField(article, "excerpt", locale) }
      : {}),
    ...(article.imageUrl ? { image: article.imageUrl } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.author ? { author: { "@type": "Person", name: article.author } } : {}),
  };

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/actualites` },
    { label: title, href: `/${locale}/actualites/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />

        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {title}
        </h1>

        <div className="mt-4 flex items-center gap-4 text-gris-clair text-sm">
          {article.author && (
            <span>
              {t("by")} <span className="font-bold text-bismarck">{article.author}</span>
            </span>
          )}
          {publishedAt && <time>{publishedAt}</time>}
        </div>

        {article.imageUrl && (
          <div className="relative mt-8 w-full aspect-video rounded-3xl overflow-hidden">
            <Image
              src={article.imageUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          </div>
        )}

        <div
          className="mt-8 prose prose-lg max-w-none text-noir
            [&_h4]:text-2xl [&_h4]:font-bold [&_h4]:mt-8 [&_h4]:mb-4
            [&_h5]:text-xl [&_h5]:font-bold [&_h5]:mt-6 [&_h5]:mb-3
            [&_p]:leading-relaxed [&_p]:mb-4
            [&_a]:text-bismarck [&_a]:underline
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/actualites/tag/${tag.slug}`}
                className="px-3 py-1 rounded-full bg-eau text-malachite text-sm font-bold hover:bg-menthe/30 transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12">
          <Link
            href="/actualites"
            className="text-link hover:underline font-bold"
          >
            &larr; {t("backToList")}
          </Link>
        </div>
      </div>
    </div>
  );
}
