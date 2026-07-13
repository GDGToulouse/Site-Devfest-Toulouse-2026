import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import KeyFiguresSection from "./KeyFiguresSection";
import { getCfpCtaUrl } from "@/lib/cfp";
import type { CfpSettings, Edition, KeyFigure } from "@/lib/types";

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

interface HeroSectionProps {
  edition: Edition | null;
  cfp: CfpSettings | null;
  locale: string;
  figures?: KeyFigure[];
}

export default function HeroSection({ edition, cfp, locale, figures = [] }: HeroSectionProps) {
  const t = useTranslations("home.hero");
  const tStats = useTranslations("home.stats");

  const heroImageUrl = edition?.heroImageUrl || null;
  const dateLabel = edition?.startDate ? formatDate(edition.startDate, locale) : null;
  const venueLabel =
    edition?.venueName && edition?.venueAddress
      ? `${edition.venueName}, ${edition.venueAddress}`
      : edition?.venueName || null;

  // Show "Become a sponsor" CTA whenever the page is meant to receive
  // visitors (i.e. anything but the sold-out state).
  const showSponsorCta = edition && edition.sponsorPageStatus !== "SOLD_OUT";
  const cfpUrl = getCfpCtaUrl(cfp);

  // Filigree monogram inside the photo, e.g. "'26" for the 2026 edition.
  const yearMonogram = edition?.year ? `'${String(edition.year).slice(-2)}` : null;

  const hasFigures = figures.length > 0;

  return (
    <section className="hero w-full bg-blanc" aria-label="DevFest Toulouse">
      {/* First screen: header + this block are sized to fill 100vh so the
          catch-phrase sits at the bottom of the fold and the figures card
          below it requires a scroll (#134). */}
      <div className="hero-screen">
      <div className="hero-inner">
        <div className="hero-content">
          {/* Visually hidden H1 holds the semantic page heading so crawlers
              and assistive tech see the full "DevFest Toulouse {year}" text.
              The two-tone visual title below is decorative (aria-hidden). */}
          <h1 className="sr-only">
            DevFest Toulouse {edition?.year ?? ""} — {t("subtitleLine1")} {t("subtitleLine2devs")}
          </h1>

          <p className="hero-title" aria-hidden="true">
            <span className="text-malachite">DevFest</span>
            <span className="text-terre-cuite">Toulouse</span>
          </p>

          <p className="hero-tagline text-noir">
            {t("subtitleLine1")} <strong>{t("subtitleLine2devs")}</strong>
            {t("subtitleLine2end")}
            <strong>{t("subtitleLine2devs2")}</strong>
          </p>

          {(dateLabel || venueLabel) && (
            <div className="hero-meta">
              {dateLabel && (
                <span className="hero-meta-item">
                  <strong className="text-noir">{dateLabel}</strong>
                </span>
              )}
              {dateLabel && venueLabel && <span className="hero-meta-dot" />}
              {venueLabel && (
                <span className="hero-meta-item">
                  <span className="text-gris">{venueLabel}</span>
                </span>
              )}
            </div>
          )}

          {(showSponsorCta || cfpUrl) && (
            <div className="hero-ctas">
              {showSponsorCta && (
                <Link
                  href="/devenir-sponsor"
                  className="rounded-[12px] border-2 border-bleu bg-blanc px-7 py-3.5 text-lg font-bold text-bleu transition-colors hover:bg-bleu hover:text-blanc"
                >
                  {t("ctaSponsor")}
                </Link>
              )}
              {cfpUrl && (
                <a
                  href={cfpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[12px] border-2 border-bleu bg-bleu px-7 py-3.5 text-lg font-bold text-blanc transition-colors hover:bg-bleu/90"
                >
                  {t("ctaTalk")}
                </a>
              )}
            </div>
          )}
        </div>

        {/* The hero image is the LCP element. It used to be a CSS
            background-image, which never reaches next/image: the raw 3.4 MB
            upload was served as-is and the browser only discovered it after
            parsing the CSS, pushing LCP past 20 s on slow 4G (#197). Rendering
            it through <Image priority> gets it WebP/AVIF conversion, a size
            matched to the viewport, a preload in the document head and
            fetchpriority=high. The overlay reproduces the darkening gradient
            the background used to carry. */}
        <div className="hero-photo" aria-hidden="true">
          {heroImageUrl && (
            <Image
              src={heroImageUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="hero-photo-img"
            />
          )}
          <span className="hero-photo-overlay" />
          {cfpUrl && <span className="hero-photo-badge text-noir">{t("cfpBadge")}</span>}
          {yearMonogram && <span className="hero-photo-wordmark">{yearMonogram}</span>}
        </div>
      </div>

        {/* Catch-phrase pinned at the bottom of the first screen. */}
        {hasFigures && (
          <h2 className="hero-figures-title text-2xl sm:text-3xl lg:text-4xl font-bold text-noir text-center px-6">
            {tStats.rich("title", {
              tech: (chunks) => <span className="text-malachite">{chunks}</span>,
              toulousain: (chunks) => <span className="text-terre-cuite">{chunks}</span>,
            })}
          </h2>
        )}
      </div>

      {/* Stats card — sits just below the fold so it needs a scroll (#134). */}
      {hasFigures && <KeyFiguresSection figures={figures} locale={locale} />}
    </section>
  );
}
