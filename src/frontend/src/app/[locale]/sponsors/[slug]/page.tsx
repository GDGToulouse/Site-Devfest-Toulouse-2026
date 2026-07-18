import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getSponsorBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const sponsor = await getSponsorBySlug(slug);

  if (!sponsor) return { title: "Sponsor not found" };

  const description = localizedField(sponsor, "description", locale) || sponsor.name;

  return {
    title: sponsor.name,
    description,
    alternates: {
      canonical: `/${locale}/sponsors/${slug}`,
      languages: {
        fr: `/fr/sponsors/${slug}`,
        en: `/en/sponsors/${slug}`,
        "x-default": `/fr/sponsors/${slug}`,
      },
    },
    // OG image = sponsor logo (RG-229).
    openGraph: {
      title: sponsor.name,
      description,
      ...(sponsor.logoUrl ? { images: [{ url: sponsor.logoUrl }] } : {}),
    },
  };
}

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  const sponsor = await getSponsorBySlug(slug);

  if (!sponsor) notFound();

  const description = localizedField(sponsor, "description", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/sponsors` },
    { label: sponsor.name, href: `/${locale}/sponsors/${slug}` },
  ];

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: sponsor.name,
    ...(sponsor.logoUrl ? { logo: sponsor.logoUrl } : {}),
    ...(sponsor.websiteUrl ? { url: sponsor.websiteUrl } : {}),
    ...(Object.values(sponsor.socialLinks).length > 0
      ? { sameAs: Object.values(sponsor.socialLinks) }
      : {}),
  };

  return (
    <div className="px-6 py-8 lg:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-5xl font-bold text-noir">{sponsor.name}</h1>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          {/* Left: description */}
          <div>
            {description ? (
              <p className="text-lg leading-relaxed text-noir whitespace-pre-line">{description}</p>
            ) : null}
          </div>

          {/* Right: logo + links */}
          <aside className="space-y-6">
            {sponsor.logoUrl && (
              <div className="relative h-40 w-full rounded-2xl bg-blanc p-6 shadow-card">
                <Image src={sponsor.logoUrl} alt={sponsor.name} fill className="object-contain p-6" sizes="320px" />
              </div>
            )}
            {sponsor.websiteUrl && (
              <a
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-[12px] bg-bleu px-6 py-3 text-center font-bold text-blanc transition-colors hover:bg-bleu/90"
              >
                {t("visitWebsite")}
              </a>
            )}
            {Object.entries(sponsor.socialLinks).length > 0 && (
              <ul className="flex flex-wrap gap-4">
                {Object.entries(sponsor.socialLinks).map(([key, url]) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bleu hover:underline capitalize"
                    >
                      {key}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        {/* Speakers of this sponsor (RG-226) */}
        {sponsor.speakers.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-bold text-noir">
              {t("speakersOf", { name: sponsor.name })}
            </h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {sponsor.speakers.map((sp) => (
                <Link
                  key={sp.slug}
                  href={`/speakers/${sp.slug}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blanc-casse">
                    {sp.photoUrl ? (
                      <Image src={sp.photoUrl} alt={sp.name} fill className="object-cover" sizes="96px" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gris">
                        {sp.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-noir group-hover:text-bleu">{sp.name}</span>
                  {sp.company && <span className="text-sm text-gris">{sp.company}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Job offers to relay (#251). Description is server-sanitized HTML. */}
        {sponsor.jobOffers.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-bold text-noir">{t("jobOffersTitle")}</h2>
            <div className="space-y-4">
              {sponsor.jobOffers.map((offer) => (
                <article key={offer.id} className="rounded-2xl border border-gris/15 bg-blanc p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-noir">{offer.title}</h3>
                  {offer.description && (
                    <div
                      className="article-content mt-2 text-sm text-gris"
                      dangerouslySetInnerHTML={{ __html: offer.description }}
                    />
                  )}
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block font-bold text-bleu hover:underline"
                  >
                    {t("jobOfferCta")} →
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
