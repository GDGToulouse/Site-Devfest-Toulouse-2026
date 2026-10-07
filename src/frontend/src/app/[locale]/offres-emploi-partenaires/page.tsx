import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { getJobOffers } from "@/lib/api";
import { SPONSORED_LINK_REL } from "@/lib/html";
import { isCareersLink, offerExcerpt, offerPath } from "@/lib/job-offers";
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

// Each offer used to be printed in full, one after the other: with five offers
// of ~3,000 characters the page was already nine screens long (#556). The list
// now shows a card per offer, and the full text lives on the offer's own page.
export default async function JobOffersPage() {
  const t = await getTranslations("jobOffers");
  const locale = await getLocale();
  const sponsors = await getJobOffers();
  const offers = sponsors.flatMap((sponsor) => sponsor.jobOffers.map((offer) => ({ sponsor, offer })));

  return (
    <div className="bg-blanc-casse">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumb items={[{ label: t("home"), href: "/" }, { label: t("title"), href: "/offres-emploi-partenaires" }]} />

        <h1 className="mt-4 text-3xl font-bold text-noir lg:text-4xl">{t("heading")}</h1>
        <p className="mt-3 max-w-prose text-gris">{t("intro")}</p>

        {offers.length === 0 ? (
          <p className="mt-12 text-gris">{t("empty")}</p>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {offers.map(({ sponsor, offer }) => {
              const isCareers = isCareersLink(offer);
              const company = (
                <div className="flex items-center gap-3">
                  {sponsor.logoUrl && (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-blanc">
                      <Image src={sponsor.logoUrl} alt="" fill className="object-contain p-1" sizes="40px" />
                    </div>
                  )}
                  <span className="text-sm font-bold text-gris">{sponsor.name}</span>
                </div>
              );
              const cardClass =
                "flex h-full flex-col rounded-2xl border border-gris/15 bg-blanc p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-bleu";
              return (
                <li key={offer.id}>
                  {isCareers ? (
                    // No description: the partner points at its careers site
                    // rather than at one job, so the card goes straight there.
                    <a href={offer.url} target="_blank" rel={SPONSORED_LINK_REL} className={cardClass}>
                      {company}
                      <h2 className="mt-4 text-lg font-bold text-noir">{offer.title}</h2>
                      <p className="mt-2 text-sm text-gris">{t("careersHint", { name: sponsor.name })}</p>
                      <span className="mt-auto pt-4 font-bold text-bleu">{t("careersLink")} →</span>
                    </a>
                  ) : (
                    <Link href={offerPath(offer)} className={cardClass}>
                      {company}
                      <h2 className="mt-4 text-lg font-bold text-noir">{offer.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm text-gris">{offerExcerpt(offer, locale)}</p>
                      <span className="mt-auto pt-4 font-bold text-bleu">{t("readOffer")} →</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
