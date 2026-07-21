import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { getCurrentEdition } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
// Client wrapper: the map's `ssr: false` dynamic import cannot live in this
// Server Component (Next.js 16), so it sits behind VenueMapClient.
import VenueMapClient from "@/components/venue/VenueMapClient";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("venue");
  return {
    title: t("pageTitle"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/lieu`,
      languages: { fr: "/fr/lieu", en: "/en/lieu", "x-default": "/fr/lieu" },
    },
  };
}

export default async function VenuePage() {
  const locale = await getLocale();
  const t = await getTranslations("venue");
  const edition = await getCurrentEdition();

  // The page only exists when there is venue info to show — otherwise the nav
  // entry is hidden anyway, and a direct hit should 404 rather than render empty.
  if (!edition || !edition.hasVenueInfo) notFound();

  const hasMap = edition.venueLat !== null && edition.venueLng !== null;
  const mapLabel = edition.venueName || t("pageTitle");

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/lieu` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("pageTitle")}
        </h1>

        {(edition.venueName || edition.venueAddress) && (
          <p className="mt-4 text-lg text-gris">
            {edition.venueName && <span className="font-medium text-noir">{edition.venueName}</span>}
            {edition.venueName && edition.venueAddress ? " — " : ""}
            {edition.venueAddress}
          </p>
        )}

        {edition.venueDirectionsUrl && (
          <a
            href={edition.venueDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-bismarck px-4 py-2 text-sm font-bold text-blanc hover:bg-bismarck/90"
          >
            {t("directions")}
          </a>
        )}

        {hasMap && (
          <div className="mt-8">
            <VenueMapClient lat={edition.venueLat!} lng={edition.venueLng!} label={mapLabel} />
          </div>
        )}

        {/* venueTransports/venueParking are rich-text HTML sanitized server-side
            on write (sanitizeRichHtml in the edition PUT, #109) — the same model
            as sponsor descriptions and article content. These fields are new and
            have a single write path, so the stored HTML is always sanitized. */}
        {edition.venueTransports && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-noir">{t("transports")}</h2>
            <div
              className="prose mt-3 max-w-none text-noir"
              dangerouslySetInnerHTML={{ __html: edition.venueTransports }}
            />
          </section>
        )}

        {edition.venueParking && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-noir">{t("parking")}</h2>
            <div
              className="prose mt-3 max-w-none text-noir"
              dangerouslySetInnerHTML={{ __html: edition.venueParking }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
