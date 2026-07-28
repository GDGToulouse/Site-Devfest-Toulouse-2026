import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSpeakerBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";
import { Link } from "@/i18n/navigation";
import { jsonLdScript } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const speaker = await getSpeakerBySlug(slug);

  if (!speaker) return { title: "Speaker not found" };

  const description = localizedField(speaker, "bio", locale) || speaker.name;

  return {
    title: speaker.name,
    description,
    alternates: {
      canonical: `/${locale}/speakers/${slug}`,
      languages: {
        fr: `/fr/speakers/${slug}`,
        en: `/en/speakers/${slug}`,
        "x-default": `/fr/speakers/${slug}`,
      },
    },
    // OG image is generated dynamically by ./opengraph-image (RG-208).
    openGraph: { title: speaker.name, description },
  };
}

export default async function SpeakerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("speakers");
  // Talk formats are translated under `replays` — the only namespace that owns
  // them. Named for what it does, so the two lookups stay legible.
  const tFormat = await getTranslations("replays");
  // Levels are only spelled out under `conferences` — `replays` has no level.*
  // key at all, so a third lookup is unavoidable here (#359).
  const tLevel = await getTranslations("conferences");
  // The edition is only needed to name the current line-up in the footer link
  // (#357); fetched alongside the speaker so the two calls do not serialize.
  const [speaker, edition] = await Promise.all([getSpeakerBySlug(slug), getCurrentEdition()]);

  if (!speaker) notFound();

  // Same fallback as the speakers list: with no featured edition the label must
  // still read, so the current year stands in.
  const currentYear = edition?.year ?? new Date().getFullYear();

  const bio = localizedField(speaker, "bio", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/speakers` },
    { label: speaker.name, href: `/${locale}/speakers/${slug}` },
  ];

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: speaker.name,
    ...(speaker.photoUrl ? { image: speaker.photoUrl } : {}),
    ...(speaker.company ? { worksFor: { "@type": "Organization", name: speaker.company } } : {}),
    ...(Object.values(speaker.socialLinks).length > 0
      ? { sameAs: Object.values(speaker.socialLinks) }
      : {}),
  };

  return (
    <div className="px-6 py-8 lg:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(personJsonLd) }}
      />
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-full bg-blanc-casse">
            {/* SpeakerPhoto, never a bare next/image: this page now serves every
                person ever, and imported profiles carry photos on third-party
                hosts. Passing those to the optimizer 500s the whole page. */}
            <SpeakerPhoto photoUrl={speaker.photoUrl} name={speaker.name} size={160} />
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-3xl lg:text-5xl font-bold text-noir">{speaker.name}</h1>
            {(speaker.company || speaker.city) && (
              <p className="mt-2 text-lg text-gris">
                {[speaker.company, speaker.city].filter(Boolean).join(" · ")}
              </p>
            )}
            {Object.entries(speaker.socialLinks).length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
                {Object.entries(speaker.socialLinks).map(([key, url]) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="capitalize text-bleu hover:underline"
                    >
                      {key}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {bio && (
          <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-noir">{bio}</p>
        )}

        {/* One section per edition, newest first (#352). A year the person took
            part in shows even with no published session — 19 people are in that
            case, and dropping them would make their page look like a mistake. */}
        {speaker.participations.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-bold text-noir">{t("sessionsTitle")}</h2>
            <div className="space-y-8">
              {speaker.participations.map((participation) => (
                <div key={participation.year}>
                  <Link
                    href={`/editions/${participation.year}`}
                    className="inline-block rounded-full bg-bismarck/10 px-3 py-1 text-sm font-bold text-bismarck transition-colors hover:bg-bismarck/20"
                  >
                    {tFormat("editionLabel", { year: participation.year })}
                  </Link>

                  {participation.talks.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {participation.talks.map((talk) => (
                        <li key={talk.slug}>
                          <Link
                            // Talks stay edition-scoped: unlike a person, a talk
                            // really does belong to one year (#343).
                            href={`/editions/${participation.year}/conferences/${talk.slug}`}
                            className="block rounded-xl bg-blanc p-4 shadow-card transition-transform hover:-translate-y-0.5"
                          >
                            {/* One line, truncated: titles range from three words
                                to a full sentence, and letting them wrap made the
                                cards ragged. The full wording is one click away,
                                and on hover meanwhile. */}
                            <p className="truncate font-bold text-noir" title={talk.title}>
                              {talk.title}
                            </p>
                            {/* Same badges as the talk page, in the same order, so
                                a session reads identically wherever it shows up. */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-bleu/10 px-3 py-1 text-sm font-bold text-bleu">
                                {tFormat(`format.${talk.format}`)}
                              </span>
                              {talk.category && (
                                <span
                                  className="rounded-full px-3 py-1 text-sm font-bold"
                                  style={{
                                    backgroundColor: `${talk.category.color}20`,
                                    color: talk.category.color,
                                  }}
                                >
                                  {localizedField(talk.category, "name", locale)}
                                </span>
                              )}
                              {talk.level && (
                                <span className="rounded-full bg-gris/10 px-3 py-1 text-sm text-noir">
                                  {tLevel(`level.${talk.level}`)}
                                </span>
                              )}
                              <span className="rounded-full bg-gris/10 px-3 py-1 text-sm text-noir">
                                {talk.language === "en" ? tFormat("language.en") : tFormat("language.fr")}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-gris">{t("noSessionThatYear")}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Two ways out: the current line-up, and the whole archive. The first
            names its year (#357) — this page is reached from a replay, a talk
            card or an external link just as often as from the list, so "all
            speakers" promised a return trip that was rarely one, and would
            strand a 2018 speaker on a list they are not part of. */}
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/speakers" className="font-bold text-bleu hover:underline">
            {t("backToList", { year: currentYear })}
          </Link>
          <Link href="/hall-of-fame" className="font-bold text-bleu hover:underline">
            {t("backToHallOfFame")}
          </Link>
        </div>
      </div>
    </div>
  );
}
