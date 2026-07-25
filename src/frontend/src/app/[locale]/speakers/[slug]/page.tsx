import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getSpeakerBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
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
  const speaker = await getSpeakerBySlug(slug);

  if (!speaker) notFound();

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
            {speaker.photoUrl ? (
              <Image src={speaker.photoUrl} alt={speaker.name} fill className="object-cover" sizes="160px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-5xl font-bold text-gris">
                {speaker.name.charAt(0)}
              </span>
            )}
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

        {speaker.talks.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-bold text-noir">{t("sessionsTitle")}</h2>
            <ul className="space-y-3">
              {speaker.talks.map((talk) => (
                <li key={talk.slug}>
                  <Link
                    href={`/conferences/${talk.slug}`}
                    className="block rounded-xl bg-blanc p-4 shadow-card transition-transform hover:-translate-y-0.5"
                  >
                    <span className="font-bold text-noir">
                      {talk.title}
                    </span>
                    <span className="ml-2 text-sm text-gris">{talk.format}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10">
          <Link href="/speakers" className="font-bold text-bleu hover:underline">
            ← {t("backToList")}
          </Link>
        </div>
      </div>
    </div>
  );
}
