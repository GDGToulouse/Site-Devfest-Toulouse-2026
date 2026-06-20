import { getLocale } from "next-intl/server";

import {
  getCfpSettings,
  getCurrentEdition,
  getEditions,
  getLatestArticles,
  getCurrentTicketTiers,
  getKeyFigures,
} from "@/lib/api";

import HeroSection from "@/components/home/HeroSection";
import KeyFiguresSection from "@/components/home/KeyFiguresSection";
import TicketingSection from "@/components/home/TicketingSection";
import ReplaySection from "@/components/home/ReplaySection";
import LatestNewsSection from "@/components/home/LatestNewsSection";
import AboutSection from "@/components/home/AboutSection";
import EcosystemSection from "@/components/home/EcosystemSection";
import SponsorsSection from "@/components/home/SponsorsSection";
import FeaturedSpeakersSection from "@/components/home/FeaturedSpeakersSection";

function buildEventJsonLd(
  edition: {
    year: number;
    startDate: string | null;
    endDate: string | null;
    venueName: string | null;
    venueAddress: string | null;
  },
  tiers: { nameFr: string; price: number; status: string; externalUrl: string | null }[],
  previousStartDates: string[] = [],
) {
  // Dedup offers by (name, price, status) — protects Schema.org output from
  // accidental duplicates in seed data or admin double-imports, which
  // otherwise surface to Google as invalid structured data.
  const seenKeys = new Set<string>();
  const offers = tiers
    .filter((t) => t.status !== "SOLD_OUT")
    .filter((t) => {
      const key = `${t.nameFr}|${t.price}|${t.status}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .map((t) => ({
      "@type": "Offer" as const,
      name: t.nameFr,
      price: t.price,
      priceCurrency: "EUR",
      availability: t.status === "AVAILABLE"
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      url: t.externalUrl ?? undefined,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `DevFest Toulouse ${edition.year}`,
    startDate: edition.startDate?.split("T")[0] ?? undefined,
    endDate: edition.endDate?.split("T")[0] ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: edition.venueName
      ? {
          "@type": "Place",
          name: edition.venueName,
          address: {
            "@type": "PostalAddress",
            addressLocality: edition.venueAddress ?? undefined,
            addressRegion: "Occitanie",
            addressCountry: "FR",
          },
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: "GDG Toulouse",
      url: "https://gdg.community.dev/gdg-toulouse/",
    },
    superEvent: {
      "@type": "Event",
      name: "DevFest",
      url: "https://developers.google.com/community/devfest",
    },
    // Past edition start dates signal the event's recurrence to search engines.
    ...(previousStartDates.length > 0 && {
      previousStartDate:
        previousStartDates.length === 1 ? previousStartDates[0] : previousStartDates,
    }),
    ...(offers.length > 0 && { offers }),
  };
}

export default async function HomePage() {
  const locale = await getLocale();

  const [edition, tiers, figures, cfp, editions] = await Promise.all([
    getCurrentEdition(),
    getCurrentTicketTiers(),
    getKeyFigures(),
    getCfpSettings(),
    getEditions(),
  ]);

  const articles = await getLatestArticles(4, edition?.id);

  // Past editions' start dates (YYYY-MM-DD) for Schema.org previousStartDate.
  const previousStartDates = editions
    .filter((e) => e.year < (edition?.year ?? Infinity) && e.startDate)
    .map((e) => e.startDate!.split("T")[0]);

  const isPreparation = edition?.status === "PREPARATION";
  const isAnnouncement = edition?.status === "ANNOUNCEMENT";
  const isSeeYouNextYear = edition?.status === "SEE_YOU_NEXT_YEAR";

  return (
    <>
      {edition && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildEventJsonLd(edition, tiers, previousStartDates)),
          }}
        />
      )}

      <HeroSection edition={edition} cfp={cfp} locale={locale} />

      {/* PREPARATION: teasing + replay from previous edition */}
      {isPreparation && edition?.previousAfterMovieUrl && (
        <ReplaySection
          aftermovieUrl={edition.previousAfterMovieUrl}
          galleryUrl={edition.previousGalleryUrl}
          editionYear={edition.previousYear}
        />
      )}

      {/* ANNOUNCEMENT: full content */}
      {isAnnouncement && figures.length > 0 && (
        <KeyFiguresSection figures={figures} locale={locale} />
      )}

      {isAnnouncement && tiers.length > 0 && (
        <TicketingSection tiers={tiers} locale={locale} />
      )}

      {isAnnouncement && edition?.previousAfterMovieUrl && (
        <ReplaySection
          aftermovieUrl={edition.previousAfterMovieUrl}
          galleryUrl={edition.previousGalleryUrl}
          editionYear={edition.previousYear}
        />
      )}

      {isAnnouncement && <SponsorsSection />}

      {isAnnouncement && <FeaturedSpeakersSection />}

      {isAnnouncement && articles.length > 0 && (
        <LatestNewsSection articles={articles} locale={locale} />
      )}

      {isAnnouncement && <AboutSection />}

      {isAnnouncement && <EcosystemSection />}

      {/* SEE_YOU_NEXT_YEAR: bilan + aftermovie + gallery + news */}
      {isSeeYouNextYear && edition?.aftermovieUrl && (
        <ReplaySection
          aftermovieUrl={edition.aftermovieUrl}
          editionYear={edition.year}
        />
      )}

      {isSeeYouNextYear && edition?.galleryUrl && (
        <section className="section-y px-6 bg-blanc-casse">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="section-title text-3xl lg:text-5xl font-bold text-noir">
              {locale === "fr" ? "Galerie photos" : "Photo gallery"}
            </h2>
            <a
              href={edition.galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-[12px] bg-bleu px-8 py-3 text-lg font-bold text-blanc hover:bg-bleu/90 transition-colors"
            >
              {locale === "fr" ? "Voir les photos" : "View photos"}
            </a>
          </div>
        </section>
      )}

      {isSeeYouNextYear && articles.length > 0 && (
        <LatestNewsSection articles={articles} locale={locale} />
      )}
    </>
  );
}
