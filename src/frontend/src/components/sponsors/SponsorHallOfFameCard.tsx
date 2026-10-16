import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { SponsorHallOfFameEntry } from "@/lib/types";

// One company on the sponsors' hall of fame (#611). Across every year it shows
// the company as it is today; under a year filter, as that year displayed it —
// logo and tier frozen on the participation (#375). Without a logo, the name
// stands in (#355): most of the imported history has none, and the page hides
// nobody.
interface SponsorHallOfFameCardProps {
  company: SponsorHallOfFameEntry;
  // The year filtered on, if any.
  year: number | null;
  locale: string;
  editionsLabel: string;
}

export default function SponsorHallOfFameCard({ company, year, locale, editionsLabel }: SponsorHallOfFameCardProps) {
  const thatYear = year ? company.participations.find((p) => p.year === year) : undefined;
  const logoUrl = thatYear ? thatYear.logoUrl : company.logoUrl;
  const years = company.participations.map((p) => p.year);

  return (
    <Link
      href={`/sponsors/${company.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-[rgba(29,29,27,0.08)] bg-blanc shadow-card transition-shadow duration-200 hover:shadow-lg"
    >
      {/* The tier belongs to a year: its colour shows only under a filter. */}
      {thatYear && <div className="h-2" style={{ backgroundColor: thatYear.tier.color }} />}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
        <div className="relative flex h-16 w-full items-center justify-center">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={company.name}
              fill
              className="object-contain"
              sizes="200px"
              // Imported logos can live on any host: keep those off the
              // optimizer, which only knows the configured ones.
              unoptimized={/^https?:\/\//.test(logoUrl)}
            />
          ) : (
            <span className="text-lg font-bold text-noir">{company.name}</span>
          )}
        </div>
        {logoUrl && <p className="font-bold text-noir group-hover:text-bleu">{company.name}</p>}
        {thatYear && (
          <p className="text-xs font-medium text-gris">{locale === "en" ? thatYear.tier.nameEn : thatYear.tier.nameFr}</p>
        )}
        <p className="text-xs text-gris">
          <span className="font-medium text-noir">{editionsLabel}</span> · {years.join(" · ")}
        </p>
      </div>
    </Link>
  );
}
