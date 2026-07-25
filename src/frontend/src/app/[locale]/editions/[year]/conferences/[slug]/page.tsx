import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getEditionTalkBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";
import { Link } from "@/i18n/navigation";

// Detail of a past talk (#343). `/conferences/[slug]` only serves the featured
// edition, so replays of past years had nowhere to link; the year in the path
// also disambiguates a title reused across editions.

interface RouteParams {
  year: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { year, slug } = await params;
  const locale = await getLocale();
  const talk = await getEditionTalkBySlug(Number(year), slug);

  if (!talk) return { title: "Session not found" };

  // Title and abstract are not localized (#293) — the talk has one language.
  const path = `/editions/${year}/conferences/${slug}`;
  return {
    title: talk.title,
    description: talk.description || talk.title,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { fr: `/fr${path}`, en: `/en${path}`, "x-default": `/fr${path}` },
    },
    openGraph: { title: talk.title, description: talk.description || talk.title },
  };
}

export default async function EditionTalkDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { year, slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("replays");
  const tc = await getTranslations("conferences");

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum)) notFound();

  const talk = await getEditionTalkBySlug(yearNum, slug);
  if (!talk) notFound();

  const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;
  const languageLabel = talk.language === "en" ? t("language.en") : t("language.fr");

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/replays` },
    { label: talk.title, href: `/${locale}/editions/${year}/conferences/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* The year links back to the edition it was given in — the piece of
              context a visitor coming from the replay list is missing. */}
          <Link
            href={`/editions/${talk.year}`}
            className="rounded-full bg-bismarck/10 px-3 py-1 text-sm font-bold text-bismarck transition-colors hover:bg-bismarck/20"
          >
            {t("editionLabel", { year: talk.year })}
          </Link>
          <span className="rounded-full bg-bleu/10 px-3 py-1 text-sm font-bold text-bleu">
            {t(`format.${talk.format}`)}
          </span>
          {talk.level && (
            <span className="rounded-full bg-gris/10 px-3 py-1 text-sm text-noir">
              {tc(`level.${talk.level}`)}
            </span>
          )}
          {categoryName && (
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ backgroundColor: `${talk.category!.color}20`, color: talk.category!.color }}
            >
              {categoryName}
            </span>
          )}
          <span className="rounded-full bg-gris/10 px-3 py-1 text-sm text-noir">{languageLabel}</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-noir lg:text-5xl">{talk.title}</h1>

        {/* Only talks that were filmed carry a video: 2016 has none at all. */}
        {talk.videoUrl && (
          <a
            href={talk.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-terre-cuite px-4 py-2 text-sm font-medium text-blanc transition-colors hover:bg-terre-cuite/90"
          >
            <span aria-hidden="true">▶</span>
            {t("watch")}
            <span className="sr-only"> — {talk.title}</span>
          </a>
        )}

        {talk.description && (
          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-noir">
            {talk.description}
          </p>
        )}

        {talk.speakers.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 text-2xl font-bold text-noir">{t("speakersLabel")}</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {talk.speakers.map((sp) => (
                <Link
                  key={sp.slug}
                  href={`/editions/${talk.year}/speakers/${sp.slug}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blanc-casse">
                    <SpeakerPhoto photoUrl={sp.photoUrl} name={sp.name} size={96} />
                  </div>
                  <span className="font-bold text-noir group-hover:text-bleu">{sp.name}</span>
                  {sp.company && <span className="text-sm text-gris">{sp.company}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12">
          <Link href="/replays" className="text-sm font-medium text-bleu hover:underline">
            ← {t("backToReplays")}
          </Link>
        </div>
      </div>
    </div>
  );
}
