import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getCfpCtaUrl } from "@/lib/cfp";
import type { CfpSettings, Edition } from "@/lib/types";

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
}

export default function HeroSection({ edition, cfp, locale }: HeroSectionProps) {
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

  const photoBackground = heroImageUrl
    ? `linear-gradient(0deg, rgba(29,29,27,0.28), rgba(29,29,27,0.28)), url('${heroImageUrl}')`
    : "linear-gradient(0deg, rgba(29,29,27,0.28), rgba(29,29,27,0.28)), url('https://picsum.photos/1600/1000?random=devfest')";

  return (
    <section className="hero w-full bg-blanc" aria-label="DevFest Toulouse">
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

          {/* Catch-phrase moved up from the key-figures section so it shows on
              the first screen (#134). Same i18n key (home.stats.title). */}
          <p className="hero-catchphrase text-noir">
            {tStats.rich("title", {
              tech: (chunks) => <span className="text-malachite">{chunks}</span>,
              toulousain: (chunks) => <span className="text-terre-cuite">{chunks}</span>,
            })}
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

        <div
          className="hero-photo"
          aria-hidden="true"
          style={{ backgroundImage: photoBackground }}
        >
          {cfpUrl && <span className="hero-photo-badge text-noir">{t("cfpBadge")}</span>}
          {yearMonogram && <span className="hero-photo-wordmark">{yearMonogram}</span>}
        </div>
      </div>
    </section>
  );
}
