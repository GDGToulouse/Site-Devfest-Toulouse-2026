import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getEditionSpeakerBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";
import { Link } from "@/i18n/navigation";
import { jsonLdScript } from "@/lib/seo";

// Detail of a speaker from a past edition (#103). `/speakers/[slug]` is scoped
// to the featured edition, so historical speakers had no page at all.

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
  const speaker = await getEditionSpeakerBySlug(Number(year), slug);

  if (!speaker) return { title: "Speaker not found" };

  const bio = localizedField(speaker, "bio", locale);
  const path = `/editions/${year}/speakers/${slug}`;
  return {
    title: speaker.name,
    description: bio || speaker.name,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { fr: `/fr${path}`, en: `/en${path}`, "x-default": `/fr${path}` },
    },
    openGraph: { title: speaker.name, description: bio || speaker.name },
  };
}

export default async function EditionSpeakerDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { year, slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("replays");
  const ts = await getTranslations("speakers");

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum)) notFound();

  const speaker = await getEditionSpeakerBySlug(yearNum, slug);
  if (!speaker) notFound();

  const bio = localizedField(speaker, "bio", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/replays` },
    { label: speaker.name, href: `/${locale}/editions/${year}/speakers/${slug}` },
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
            <SpeakerPhoto photoUrl={speaker.photoUrl} name={speaker.name} size={160} />
          </div>

          <div className="text-center sm:text-left">
            <Link
              href={`/editions/${speaker.year}`}
              className="inline-block rounded-full bg-bismarck/10 px-3 py-1 text-sm font-bold text-bismarck transition-colors hover:bg-bismarck/20"
            >
              {t("editionLabel", { year: speaker.year })}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-noir lg:text-5xl">{speaker.name}</h1>
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

        {bio && <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-noir">{bio}</p>}

        {speaker.talks.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-bold text-noir">{ts("sessionsTitle")}</h2>
            <ul className="space-y-3">
              {speaker.talks.map((talk) => (
                <li key={talk.slug}>
                  <Link
                    href={`/editions/${speaker.year}/conferences/${talk.slug}`}
                    className="block rounded-xl bg-blanc p-4 shadow-card transition-transform hover:-translate-y-0.5"
                  >
                    <span className="font-bold text-noir">{talk.title}</span>
                    <span className="ml-2 text-sm text-gris">{t(`format.${talk.format}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
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
