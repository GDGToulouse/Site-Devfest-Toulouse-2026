import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Edition } from "@/lib/types";

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
  locale: string;
}

export default function HeroSection({ edition, locale }: HeroSectionProps) {
  const t = useTranslations("home.hero");

  const heroImageUrl = edition?.heroImageUrl || null;
  const dateLabel = edition?.startDate ? formatDate(edition.startDate, locale) : null;
  const venueLabel =
    edition?.venueName && edition?.venueAddress
      ? `${edition.venueName}, ${edition.venueAddress}`
      : edition?.venueName || null;

  const partnerUrl = edition?.partnerFormUrl || null;
  const cfpUrl = edition?.cfpUrl || null;

  const backgroundImage = heroImageUrl
    ? `linear-gradient(0deg, rgba(29, 29, 27, 0.3), rgba(29, 29, 27, 0.3)), url('${heroImageUrl}')`
    : "linear-gradient(0deg, rgba(29, 29, 27, 0.3), rgba(29, 29, 27, 0.3)), url('https://picsum.photos/1200/800?random=devfest')";

  return (
    <section className="relative w-full bg-blanc">
      {/* Background photo — starts at 1/3 of max-w container, extends to right edge of viewport */}
      <div
        className="absolute top-0 bottom-0 left-0 lg:left-[max(0px,calc(50%-240px))] right-0 bg-cover bg-center"
        style={{
          backgroundImage,
          borderRadius: "64px 0px 0px 64px",
        }}
      />
      <div className="relative mx-auto max-w-[1440px] min-h-[600px] lg:min-h-[700px]">

        {/* 5 staircase blocks — pyramid effect */}
        <div className="relative z-10 flex min-h-[600px] lg:min-h-[700px] items-center">
          <div className="flex flex-col items-start">
            {/* Block 1: DevFest — most indented, rounded top-right only */}
            <div
              className="bg-blanc pl-8 lg:pl-[150px] pr-8 lg:pr-[45px] pt-[10px] pb-[2px]"
              style={{ borderTopRightRadius: "40px" }}
            >
              <h1>
                <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-malachite">
                  DevFest
                </span>
              </h1>
            </div>

            {/* Block 2: Toulouse + subtitle line 1 */}
            <div
              className="bg-blanc pl-8 lg:pl-[225px] pr-8 lg:pr-[45px] pt-[2px] pb-[10px]"
              style={{ borderTopRightRadius: "40px", borderBottomRightRadius: "40px" }}
            >
              <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-terre-cuite">
                Toulouse
              </span>
              <p className="pt-[22px] text-lg sm:text-xl lg:text-2xl text-noir/80 leading-relaxed">
                {t("subtitleLine1")}
              </p>
            </div>

            {/* Block 3: subtitle line 2 */}
            <div
              className="bg-blanc pl-8 lg:pl-[225px] pr-8 lg:pr-[45px] pt-0 pb-[20px] -mt-[10px]"
              style={{ borderBottomRightRadius: "40px" }}
            >
              <p className="text-lg leading-none sm:text-xl sm:leading-none lg:text-2xl lg:leading-none text-noir/80 pt-[3px]">
                <strong>{t("subtitleLine2devs")}</strong>
                {t("subtitleLine2end")}
                <strong>{t("subtitleLine2devs2")}</strong>
              </p>
            </div>

            {/* Block 4: Date */}
            {dateLabel && (
              <div
                className="bg-blanc pl-8 lg:pl-[225px] pr-8 lg:pr-[45px] py-[2px]"
                style={{ borderBottomRightRadius: "40px" }}
              >
                <p className="text-lg text-noir">
                  <strong>{dateLabel}</strong>
                </p>
              </div>
            )}

            {/* Block 5: Venue */}
            {venueLabel && (
              <div
                className="bg-blanc pl-8 lg:pl-[225px] pr-8 lg:pr-[45px] py-[2px]"
                style={{ borderBottomRightRadius: "40px" }}
              >
                <p className="text-lg text-noir/70">
                  {venueLabel}
                </p>
              </div>
            )}

            {/* Buttons */}
            {(partnerUrl || cfpUrl) && (
              <div className="mt-16 pl-8 lg:pl-[225px] flex flex-col sm:flex-row gap-4">
                {partnerUrl && (
                  <Link
                    href="/devenir-sponsor"
                    className="px-8 py-5 rounded-[12px] border-3 border-bleu bg-blanc text-bleu font-bold text-2xl hover:bg-bleu hover:text-blanc transition-colors text-center"
                  >
                    {t("ctaPartner")}
                  </Link>
                )}
                {cfpUrl && (
                  <a
                    href={cfpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-5 rounded-[12px] border-3 border-bleu bg-bleu text-blanc font-bold text-2xl hover:bg-bleu/90 transition-colors text-center"
                  >
                    {t("ctaTalk")}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
