import { getLocale } from "next-intl/server";

import {
  getCurrentEdition,
  getLatestArticles,
  getCurrentTicketTiers,
  getKeyFigures,
} from "@/lib/api";

import HeroSection from "@/components/home/HeroSection";
import KeyFiguresSection from "@/components/home/KeyFiguresSection";
import AboutSection from "@/components/home/AboutSection";
import LatestNewsSection from "@/components/home/LatestNewsSection";
import TicketingSection from "@/components/home/TicketingSection";
import ReplaySection from "@/components/home/ReplaySection";

function buildEventJsonLd(edition: {
  year: number;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
}) {
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
  };
}

export default async function HomePage() {
  const locale = await getLocale();

  const [edition, articles, tiers, figures] = await Promise.all([
    getCurrentEdition(),
    getLatestArticles(4),
    getCurrentTicketTiers(),
    getKeyFigures(),
  ]);

  const isAnnouncement = edition?.status === "ANNOUNCEMENT";

  return (
    <>
      {edition && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildEventJsonLd(edition)),
          }}
        />
      )}

      <HeroSection edition={edition} locale={locale} />

      {isAnnouncement && figures.length > 0 && (
        <KeyFiguresSection figures={figures} locale={locale} />
      )}

      {/* Sponsors section: hidden until Lot 2 — RG-141 */}

      {isAnnouncement && <AboutSection />}

      {isAnnouncement && articles.length > 0 && (
        <LatestNewsSection articles={articles} locale={locale} />
      )}

      {isAnnouncement && tiers.length > 0 && (
        <TicketingSection tiers={tiers} locale={locale} />
      )}

      {edition?.aftermovieUrl && (
        <ReplaySection aftermovieUrl={edition.aftermovieUrl} />
      )}
    </>
  );
}
