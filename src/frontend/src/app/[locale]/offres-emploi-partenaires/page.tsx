import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { getJobOffers } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("jobOffers");
  return {
    title: t("title"),
    description: t("description"),
    ...(await pageMetadata(locale, "/offres-emploi-partenaires")),
  };
}

export default async function JobOffersPage() {
  const t = await getTranslations("jobOffers");
  const locale = await getLocale();
  const sponsors = await getJobOffers();

  return (
    <div className="bg-blanc-casse">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Breadcrumb items={[{ label: t("home"), href: "/" }, { label: t("title"), href: "/offres-emploi-partenaires" }]} />

        <h1 className="mt-4 text-3xl font-bold text-noir lg:text-4xl">{t("heading")}</h1>
        <p className="mt-3 max-w-prose text-gris">{t("intro")}</p>

        {sponsors.length === 0 ? (
          <p className="mt-12 text-gris">{t("empty")}</p>
        ) : (
          <div className="mt-10 space-y-12">
            {sponsors.map((sponsor) => (
              <section key={sponsor.slug}>
                <div className="mb-4 flex items-center gap-3">
                  {sponsor.logoUrl && (
                    <div className="relative h-10 w-10 overflow-hidden rounded bg-blanc">
                      <Image src={sponsor.logoUrl} alt={sponsor.name} fill className="object-contain p-1" sizes="40px" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-noir">
                    <Link href={`/sponsors/${sponsor.slug}`} className="hover:text-bleu">
                      {sponsor.name}
                    </Link>
                  </h2>
                </div>
                <div className="space-y-4">
                  {sponsor.jobOffers.map((offer) => {
                    // Locale description with fallback to the other language (#273).
                    const description =
                      (locale === "en" ? offer.descriptionEn : offer.descriptionFr) ||
                      offer.descriptionFr ||
                      offer.descriptionEn;
                    return (
                    <article key={offer.id} className="rounded-2xl border border-gris/15 bg-blanc p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-noir">{offer.title}</h3>
                      {description && (
                        <div
                          className="article-content mt-2 text-sm text-gris"
                          dangerouslySetInnerHTML={{ __html: description }}
                        />
                      )}
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block font-bold text-bleu hover:underline"
                      >
                        {t("cta")} →
                      </a>
                    </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
