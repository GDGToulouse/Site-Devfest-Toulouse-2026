import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { localizedField } from "@/lib/i18n-helpers";
import type { Article } from "@/lib/types";

interface ArticleCardProps {
  article: Article;
  locale: string;
}

export default function ArticleCard({ article, locale }: ArticleCardProps) {
  const t = useTranslations("home.news");
  const title = localizedField(article, "title", locale);
  const excerpt = localizedField(article, "excerpt", locale);
  const publishedAt = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <article className="flex flex-col w-full max-w-[300px] bg-blanc rounded-3xl shadow-card overflow-hidden">
      {article.imageUrl && (
        <div className="relative w-[280px] h-[210px] mx-auto mt-[10px] rounded-[26px] overflow-hidden">
          <Image
            src={article.imageUrl}
            alt={title}
            fill
            className="object-cover"
            loading="lazy"
            sizes="280px"
          />
        </div>
      )}

      <div className="flex flex-col flex-1 px-4 py-4">
        <h2 className="text-lg font-bold text-noir line-clamp-2 leading-tight">
          {title}
        </h2>

        {excerpt && (
          <p className="mt-2 text-sm text-gris line-clamp-2">{excerpt}</p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          <div>
            {article.author && (
              <p className="text-xs">
                <span className="text-gris-clair">by </span>
                <span className="font-bold text-bismarck">{article.author}</span>
              </p>
            )}
            {publishedAt && (
              <p className="text-[10px] text-gris-clair">{publishedAt}</p>
            )}
          </div>
          <Link
            href={`/actualites/${article.slug}`}
            className="text-base text-link font-normal hover:underline"
            aria-label={`${t("readArticle")} : ${title}`}
          >
            {t("readArticle")}
          </Link>
        </div>
      </div>
    </article>
  );
}
