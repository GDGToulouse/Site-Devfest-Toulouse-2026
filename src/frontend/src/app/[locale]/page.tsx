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

const eventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "DevFest Toulouse 2026",
  startDate: "2026-11-19",
  endDate: "2026-11-19",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "Diagora",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Labège",
      addressRegion: "Occitanie",
      addressCountry: "FR",
    },
  },
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
  previousStartDate: [
    "2025-11-20",
    "2024-11-07",
    "2023-11-16",
    "2019-10-03",
    "2018-11-08",
    "2017-09-28",
    "2016-11-03",
  ],
};

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />

      <HeroSection />

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
