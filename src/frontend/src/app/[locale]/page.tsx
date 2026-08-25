import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getCfpSettings,
  getCurrentEdition,
  getLatestArticles,
  getCurrentTicketTiers,
  getKeyFigures,
  getSeoSettings,
  getSponsors,
  getFeaturedSpeakers,
  getEcosystemPartners,
} from "@/lib/api";

import { pageMetadata } from "@/lib/page-metadata";
import { absoluteUrl, isCompleteEvent, jsonLdScript } from "@/lib/seo";
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
    heroImageUrl: string | null;
  },
  tiers: { nameFr: string; price: number; status: string; externalUrl: string | null; saleStartDate: string | null }[],
  // Recommended-but-missing fields flagged by Search Console (#185).
  extras: {
    description: string;
    ogImage: string | null;
    speakerNames: string[];
  },
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
      // When the tier opens for sale (recommended by Google, #185).
      validFrom: t.saleStartDate?.split("T")[0] ?? undefined,
    }));

  // Google recommends `image` on an Event, so always emit one: the admin's OG
  // override if set, else the edition hero, else the site's default OG image
  // (#185). `performer` stays conditional — an empty array would be invalid.
  const image = extras.ogImage ?? edition.heroImageUrl ?? "/images/og-default.png";

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `DevFest Toulouse ${edition.year}`,
    description: extras.description,
    image: absoluteUrl(image),
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
    // Speakers, once announced (#185). Omitted entirely while the line-up is
    // empty rather than emitting an empty array.
    ...(extras.speakerNames.length > 0 && {
      performer: extras.speakerNames.map((name) => ({ "@type": "Person" as const, name })),
    }),
    // No `superEvent`: Google treats any nested `Event` as a full Event and
    // demands startDate/location on it, so pointing at the generic DevFest page
    // produced two critical errors in Search Console — for a property Google
    // does not even use for rich results (#185). `organizer` already ties the
    // event to GDG Toulouse.
    // No `previousStartDate`: Google reads it as "this occurrence was moved
    // from that date" and then requires eventStatus=EventRescheduled, which
    // invalidated the rich result. A yearly DevFest is not a rescheduled
    // event, so we simply omit it (#239).
    ...(offers.length > 0 && { offers }),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    // Absolute: the title already names the brand, and the layout template
    // would append it a second time. Without this export the home page fell
    // back on the layout's 21-character default — the most strategic page on
    // the site using a third of its room in a result list (#381).
    title: { absolute: t("pageTitle") },
    description: t("description"),
    ...(await pageMetadata(locale, "")),
  };
}

export default async function HomePage() {
  const locale = await getLocale();
  const [tSite, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getSeoSettings(),
  ]);

  const [edition, tiers, figures, cfp, sponsors, speakers, partners] = await Promise.all([
    getCurrentEdition(),
    getCurrentTicketTiers(),
    getKeyFigures(),
    getCfpSettings(),
    getSponsors(),
    getFeaturedSpeakers(),
    getEcosystemPartners(),
  ]);

  const articles = await getLatestArticles(4, edition?.id);

  const isPreparation = edition?.status === "PREPARATION";
  const isAnnouncement = edition?.status === "ANNOUNCEMENT";
  const isSeeYouNextYear = edition?.status === "SEE_YOU_NEXT_YEAR";

  const eventJsonLd = edition
    ? buildEventJsonLd(edition, tiers, {
        description: tSite("description"),
        ogImage: seoSettings.seo_og_image || null,
        speakerNames: speakers.map((s) => s.name),
      })
    : null;

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
      {/* Nothing rather than an Event short of a field Google requires (#464):
          an edition still in preparation has neither date nor venue, and the
          two together are the pair Search Console reports as critical. */}
      {eventJsonLd && isCompleteEvent(eventJsonLd) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(eventJsonLd) }}
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
