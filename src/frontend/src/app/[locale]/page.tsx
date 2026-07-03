import { Fragment, type ReactNode } from "react";
import { getLocale } from "next-intl/server";

import {
  getCfpSettings,
  getCurrentEdition,
  getEditions,
  getLatestArticles,
  getCurrentTicketTiers,
  getKeyFigures,
  getSponsors,
  getFeaturedSpeakers,
  getEcosystemPartners,
} from "@/lib/api";

import type { SectionSurface } from "@/components/home/section-surface";

import HeroSection from "@/components/home/HeroSection";
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

  const [edition, tiers, figures, cfp, editions, sponsors, speakers, partners] = await Promise.all([
    getCurrentEdition(),
    getCurrentTicketTiers(),
    getKeyFigures(),
    getCfpSettings(),
    getEditions(),
    getSponsors(),
    getFeaturedSpeakers(),
    getEcosystemPartners(),
  ]);

  const articles = await getLatestArticles(4, edition?.id);

  // Past editions' start dates (YYYY-MM-DD) for Schema.org previousStartDate.
  const previousStartDates = editions
    .filter((e) => e.year < (edition?.year ?? Infinity) && e.startDate)
    .map((e) => e.startDate!.split("T")[0]);

  const isPreparation = edition?.status === "PREPARATION";
  const isAnnouncement = edition?.status === "ANNOUNCEMENT";
  const isSeeYouNextYear = edition?.status === "SEE_YOU_NEXT_YEAR";

  // Background alternation is computed at render over the sections that are
  // actually visible, so the blanc / blanc-cassé rhythm stays regular even when
  // a conditional section (sponsors, speakers, news…) is empty (#135).
  type HomeSection = {
    show: boolean;
    render: (surface: SectionSurface) => ReactNode;
  };

  function renderWithAlternation(sections: HomeSection[]): ReactNode[] {
    let i = 0;
    return sections
      .filter((s) => s.show)
      .map((s, idx) => {
        const surface: SectionSurface = i % 2 === 0 ? "blanc-casse" : "blanc";
        i += 1;
        return <Fragment key={idx}>{s.render(surface)}</Fragment>;
      });
  }

  // Key figures are rendered inside the hero (#134); the remaining sections
  // alternate blanc / blanc-cassé over whichever ones are visible (#135).
  const announcementSections: HomeSection[] = [
    {
      show: tiers.length > 0,
      render: (surface) => <TicketingSection tiers={tiers} locale={locale} surface={surface} />,
    },
    {
      show: Boolean(edition?.previousAfterMovieUrl),
      render: (surface) => (
        <ReplaySection
          aftermovieUrl={edition!.previousAfterMovieUrl!}
          galleryUrl={edition?.previousGalleryUrl}
          editionYear={edition?.previousYear}
          surface={surface}
        />
      ),
    },
    {
      show: sponsors.length > 0,
      render: (surface) => <SponsorsSection sponsors={sponsors} surface={surface} />,
    },
    {
      show: speakers.length > 0,
      render: (surface) => <FeaturedSpeakersSection speakers={speakers} surface={surface} />,
    },
    {
      show: articles.length > 0,
      render: (surface) => <LatestNewsSection articles={articles} locale={locale} surface={surface} />,
    },
    {
      show: true,
      render: (surface) => <AboutSection surface={surface} />,
    },
    {
      show: partners.length > 0,
      render: (surface) => <EcosystemSection partners={partners} surface={surface} />,
    },
  ];

  const seeYouNextYearSections: HomeSection[] = [
    {
      show: Boolean(edition?.aftermovieUrl),
      render: (surface) => (
        <ReplaySection
          aftermovieUrl={edition!.aftermovieUrl!}
          editionYear={edition?.year}
          surface={surface}
        />
      ),
    },
    {
      show: Boolean(edition?.galleryUrl),
      render: (surface) => (
        <section className={`section-y px-6 ${surface === "blanc" ? "bg-blanc" : "bg-blanc-casse"}`}>
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="section-title text-3xl lg:text-5xl font-bold text-noir">
              {locale === "fr" ? "Galerie photos" : "Photo gallery"}
            </h2>
            <a
              href={edition!.galleryUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-[12px] bg-bleu px-8 py-3 text-lg font-bold text-blanc hover:bg-bleu/90 transition-colors"
            >
              {locale === "fr" ? "Voir les photos" : "View photos"}
            </a>
          </div>
        </section>
      ),
    },
    {
      show: articles.length > 0,
      render: (surface) => <LatestNewsSection articles={articles} locale={locale} surface={surface} />,
    },
  ];

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

      {/* Key figures live inside the hero (announcement only) so the
          catch-phrase title shows on the first screen (#134). */}
      <HeroSection
        edition={edition}
        cfp={cfp}
        locale={locale}
        figures={isAnnouncement ? figures : []}
      />

      {/* PREPARATION: teasing + replay from previous edition */}
      {isPreparation && edition?.previousAfterMovieUrl && (
        <ReplaySection
          aftermovieUrl={edition.previousAfterMovieUrl}
          galleryUrl={edition.previousGalleryUrl}
          editionYear={edition.previousYear}
        />
      )}

      {/* ANNOUNCEMENT: full content, with computed background alternation.
          Key figures are rendered inside the hero (#134), so they are not in
          this list. */}
      {isAnnouncement && renderWithAlternation(announcementSections)}

      {/* SEE_YOU_NEXT_YEAR: bilan + aftermovie + gallery + news */}
      {isSeeYouNextYear && renderWithAlternation(seeYouNextYearSections)}
    </>
  );
}
