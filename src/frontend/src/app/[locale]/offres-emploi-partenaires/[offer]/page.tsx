import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getJobOffers } from "@/lib/api";
import { markLinksSponsored, SPONSORED_LINK_REL } from "@/lib/html";
import {
  findOffer,
  isCareersLink,
  offerDescription,
  offerExcerpt,
  offerIdFromSegment,
  offerOnlyLocale,
  offerPath,
  offerSegment,
} from "@/lib/job-offers";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

// One partner job offer, in full (#556). Resolved from the public list rather
// than a dedicated endpoint: it holds the current edition's offers only, so an
// offer withdrawn or from a past edition is not found and the page 404s.
async function resolveOffer(segment: string) {
  const id = offerIdFromSegment(segment);
  if (id === null) return null;
  const found = findOffer(await getJobOffers(), id);
  // A careers-site link has nothing to show beyond its URL: the list card opens
  // the site directly, and there is no page for it.
  if (!found || isCareersLink(found.offer)) return null;
  return found;
}

export async function generateMetadata({ params }: { params: Promise<{ offer: string }> }): Promise<Metadata> {
  const { offer: segment } = await params;
  const locale = await getLocale();
  const t = await getTranslations("jobOffers");
  const found = await resolveOffer(segment);
  if (!found) return { title: t("title") };

  const { sponsor, offer } = found;
  return {
    title: t("offerTitle", { title: offer.title, name: sponsor.name }),
    description: offerExcerpt(offer, locale, 160),
    ...(await pageMetadata(
      locale,
      offerPath(offer),
      sponsor.logoUrl ? { images: [{ url: sponsor.logoUrl }] } : {},
      offerOnlyLocale(offer),
    )),
  };
}

export default async function JobOfferPage({ params }: { params: Promise<{ offer: string }> }) {
  const { offer: segment } = await params;
  const locale = await getLocale();
  const t = await getTranslations("jobOffers");
  const found = await resolveOffer(segment);
  if (!found) notFound();

  const { sponsor, offer } = found;
  // The title is in the address for people, the id finds the offer: an address
  // shared before the title was edited still lands on the right page.
  if (segment !== offerSegment(offer)) permanentRedirect(`/${locale}${offerPath(offer)}`);

  return (
    <div className="bg-blanc-casse">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Breadcrumb
          items={[
            { label: t("home"), href: "/" },
            { label: t("title"), href: "/offres-emploi-partenaires" },
            { label: offer.title, href: offerPath(offer) },
          ]}
        />

        <article className="mt-6 rounded-2xl border border-gris/15 bg-blanc p-6 shadow-sm lg:p-8">
          <div className="flex items-center gap-3">
            {sponsor.logoUrl && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-blanc">
                <Image src={sponsor.logoUrl} alt="" fill className="object-contain p-1" sizes="48px" />
              </div>
            )}
            <Link href={`/sponsors/${sponsor.slug}`} className="text-sm font-bold text-gris hover:text-bleu">
              {t("postedBy", { name: sponsor.name })}
            </Link>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-noir lg:text-3xl">{offer.title}</h1>

          <div
            className="article-content mt-6 text-noir"
            dangerouslySetInnerHTML={{ __html: markLinksSponsored(offerDescription(offer, locale)) }}
          />

          <a
            href={offer.url}
            target="_blank"
            rel={SPONSORED_LINK_REL}
            className="mt-8 inline-block rounded-[12px] bg-bleu px-[18px] py-3 font-bold text-blanc hover:bg-bleu/90"
          >
            {t("cta")} →
          </a>
        </article>

        <Link href="/offres-emploi-partenaires" className="mt-8 inline-block font-bold text-bleu hover:underline">
          ← {t("backToList")}
        </Link>
      </div>
    </div>
  );
}
