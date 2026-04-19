import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { getEditionByYear, getEditions } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
import YouTubeFacade from "@/components/YouTubeFacade";
import StatIcon from "@/components/home/StatIcon";
import { Link } from "@/i18n/navigation";

interface PageProps {
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year } = await params;
  const locale = await getLocale();
  const t = await getTranslations("bilan");
  return {
    title: t("pageTitle", { year }),
    description: t("description", { year }),
    alternates: {
      canonical: `/${locale}/editions/${year}`,
      languages: {
        fr: `/fr/editions/${year}`,
        en: `/en/editions/${year}`,
        "x-default": `/fr/editions/${year}`,
      },
    },
  };
}

function formatDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default async function BilanPage({ params }: PageProps) {
  const { year } = await params;
  const locale = await getLocale();
  const t = await getTranslations("bilan");

  const [edition, allEditions] = await Promise.all([
    getEditionByYear(Number(year)),
    getEditions(),
  ]);
  if (!edition) notFound();

  // Prev/next navigation across archived editions only — going forward
  // from a recap to the upcoming edition would be jarring.
  const archivedYears = allEditions
    .filter((e) => e.status === "SEE_YOU_NEXT_YEAR")
    .map((e) => e.year)
    .sort((a, b) => a - b);
  const idx = archivedYears.indexOf(edition.year);
  const previousYear = idx > 0 ? archivedYears[idx - 1] : null;
  const nextYear = idx >= 0 && idx < archivedYears.length - 1 ? archivedYears[idx + 1] : null;

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle", { year: edition.year }), href: `/${locale}/editions/${edition.year}` },
  ];

  const heroImageUrl = edition.heroImageUrl || null;
  const dateLabel = edition.startDate ? formatDate(edition.startDate, locale) : null;
  const venueLabel =
    edition.venueName && edition.venueAddress
      ? `${edition.venueName}, ${edition.venueAddress}`
      : edition.venueName || null;

  return (
    <div>
      {/* Hero banner */}
      <div
        className="relative w-full h-[280px] lg:h-[380px] bg-cover bg-center"
        style={{
          backgroundImage: heroImageUrl
            ? `linear-gradient(0deg, rgba(29,29,27,0.5), rgba(29,29,27,0.2)), url('${heroImageUrl}')`
            : "linear-gradient(135deg, #0B7350 0%, #109E6E 50%, #41B38E 100%)",
        }}
      >
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-6 pb-8">
            <h1 className="text-4xl lg:text-[64px] lg:leading-[120%] font-bold text-blanc drop-shadow-lg">
              DevFest Toulouse {edition.year}
            </h1>
            {(dateLabel || venueLabel) && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                {dateLabel && (
                  <p className="text-blanc/90 text-lg">{dateLabel}</p>
                )}
                {venueLabel && (
                  <p className="text-blanc/80 text-lg">{venueLabel}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-8 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <Breadcrumb items={breadcrumbItems} />

          {/* Key figures */}
          {edition.keyFigures.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
                {t("keyFigures")}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {edition.keyFigures.map((fig) => (
                  <div
                    key={fig.icon + fig.value}
                    className="flex flex-col items-center text-center p-6 rounded-xl bg-blanc shadow-card"
                  >
                    <StatIcon name={fig.icon} className="text-3xl lg:text-4xl" />
                    <span className="mt-2 text-3xl lg:text-4xl font-bold text-noir">
                      {fig.value}
                    </span>
                    <span className="mt-1 text-sm lg:text-base text-gris">
                      {localizedField(fig, "label", locale)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Aftermovie */}
          {edition.aftermovieUrl && (
            <section className="mt-16">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
                {t("aftermovie")}
              </h2>
              <YouTubeFacade
                videoUrl={edition.aftermovieUrl}
                title={`DevFest Toulouse ${edition.year} Aftermovie`}
              />
            </section>
          )}

          {/* Gallery link */}
          {edition.galleryUrl && (
            <section className="mt-16">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-6">
                {t("gallery")}
              </h2>
              <a
                href={edition.galleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors"
              >
                {t("galleryLink")}
              </a>
            </section>
          )}

          {/* Articles from this edition */}
          {edition.articles.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
                {t("news")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {edition.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/actualites/${article.slug}`}
                    className="group rounded-xl overflow-hidden bg-blanc shadow-card hover:shadow-lg transition-shadow"
                  >
                    {article.imageUrl && (
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={article.imageUrl}
                          alt={localizedField(article, "title", locale)}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold text-noir group-hover:text-malachite transition-colors line-clamp-2">
                        {localizedField(article, "title", locale)}
                      </p>
                      {localizedField(article, "excerpt", locale) && (
                        <p className="mt-2 text-sm text-gris line-clamp-2">
                          {localizedField(article, "excerpt", locale)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Archived site link */}
          {edition.archivedSiteUrl && (
            <section className="mt-16 text-center">
              <a
                href={edition.archivedSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-[12px] border-2 border-bleu text-bleu font-bold hover:bg-bleu hover:text-blanc transition-colors"
              >
                {t("archivedSite")}
              </a>
            </section>
          )}

          {/* Prev/next archived edition */}
          {(previousYear || nextYear) && (
            <nav
              aria-label={t("editions")}
              className="mt-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-gris/20 pt-8"
            >
              <div className="flex-1">
                {previousYear && (
                  <Link
                    href={`/editions/${previousYear}`}
                    rel="prev"
                    className="group flex items-center gap-3 px-5 py-3 rounded-[12px] border border-gris/30 hover:border-bleu hover:bg-bleu/5 transition-colors"
                  >
                    <span aria-hidden="true" className="text-bleu text-xl group-hover:-translate-x-1 transition-transform">←</span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-xs uppercase tracking-wide text-gris">{t("previousEdition")}</span>
                      <span className="text-noir font-bold">DevFest Toulouse {previousYear}</span>
                    </span>
                  </Link>
                )}
              </div>
              <div className="flex-1 sm:text-right">
                {nextYear && (
                  <Link
                    href={`/editions/${nextYear}`}
                    rel="next"
                    className="group flex items-center justify-end gap-3 px-5 py-3 rounded-[12px] border border-gris/30 hover:border-bleu hover:bg-bleu/5 transition-colors"
                  >
                    <span className="flex flex-col leading-tight text-right">
                      <span className="text-xs uppercase tracking-wide text-gris">{t("nextEdition")}</span>
                      <span className="text-noir font-bold">DevFest Toulouse {nextYear}</span>
                    </span>
                    <span aria-hidden="true" className="text-bleu text-xl group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
