import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getCurrentEdition, getEditionByYear } from "@/lib/api";
import { parseEditionYear } from "@/lib/edition-year";
import { getEditionTalkPage } from "@/lib/preview";
import { localizedField } from "@/lib/i18n-helpers";
import { pageMetadata } from "@/lib/page-metadata";
import { buildVideoJsonLd, canonicalLocaleFor, jsonLdScript } from "@/lib/seo";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";
import YouTubeFacade from "@/components/YouTubeFacade";
import { Link } from "@/i18n/navigation";

// Detail of a past talk (#343). `/conferences/[slug]` only serves the featured
// edition, so replays of past years had nowhere to link; the year in the path
// also disambiguates a title reused across editions.

interface RouteParams {
  locale: string;
  year: string;
  slug: string;
}

// Rendered on the first request of each record, then cached (#700). Empty:
// nothing is prerendered at build time, when the backend is not reachable.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, year, slug } = await params;
  setRequestLocale(locale);
  const yearNum = parseEditionYear(year);
  if (yearNum === null) notFound();
  const talk = await getEditionTalkPage(yearNum, slug);

  if (!talk) return { title: "Session not found" };

  // Title and abstract are not localized (#293) — the talk has one language.
  const path = `/editions/${year}/conferences/${slug}`;
  return {
    title: talk.title,
    description: talk.description || talk.title,
    // Canonical on the talk's own language (#468) — see /conferences/[slug].
    ...(await pageMetadata(locale, path, {}, canonicalLocaleFor(talk.language))),
  };
}

export default async function EditionTalkDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, year, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("replays");
  const tc = await getTranslations("conferences");

  // Not a year: a 404 without asking the backend, which would refuse it (#703).
  const yearNum = parseEditionYear(year);
  if (yearNum === null) notFound();

  // One page per talk of the featured edition (#633): two pages cached apart
  // drifted, one of them missing a speaker. Temporary on purpose — the
  // featured edition moves on each year, and a remembered permanent redirect
  // would keep sending this address to /conferences once it 404s there.
  if (yearNum === (await getCurrentEdition())?.year) {
    redirect(`/${locale}/conferences/${encodeURIComponent(slug)}`);
  }

  const talk = await getEditionTalkPage(yearNum, slug);
  if (!talk) notFound();

  // A replay as a VideoObject (#382). Its upload date is the edition's: a
  // recording cannot precede the talk. Fetched only for filmed talks.
  const edition = talk.videoUrl ? await getEditionByYear(yearNum) : null;
  const videoJsonLd = talk.videoUrl
    ? buildVideoJsonLd({ ...talk, videoUrl: talk.videoUrl }, edition?.startDate?.split("T")[0] ?? null)
    : null;

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
        {videoJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(videoJsonLd) }}
          />
        )}
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

        {/* Only talks that were filmed carry a video: 2016 has none at all.
            The facade keeps YouTube out of the page until the visitor asks for
            it, so embedding here costs nothing on load (#348). */}
        {talk.videoUrl && (
          <div className="mt-6">
            <YouTubeFacade videoUrl={talk.videoUrl} title={talk.title} />
          </div>
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
                  href={`/speakers/${sp.slug}`}
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
