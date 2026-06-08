import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import ArticleCard from "@/components/ArticleCard";
import type { Article } from "@/lib/types";

interface LatestNewsSectionProps {
  articles: Article[];
  locale: string;
}

export default function LatestNewsSection({ articles, locale }: LatestNewsSectionProps) {
  const t = useTranslations("home.news");

  if (articles.length === 0) return null;

  return (
    <section className="px-6 py-10 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl lg:text-5xl font-bold text-noir">
            {t("title")}
          </h2>
          <Link
            href="/actualites"
            className="text-link hover:underline font-normal text-base"
          >
            {t("readMore")}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
