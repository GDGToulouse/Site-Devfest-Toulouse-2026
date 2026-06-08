import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SponsorPublic, SponsorLevel } from "@/lib/types";

// Coloured banner per level (RG-224): Platinum → Émeraude, Gold → Jaune,
// Silver/Soutien/Communauté → Rose.
const LEVEL_BANNER: Record<SponsorLevel, string> = {
  PLATINUM: "bg-emeraude",
  GOLD: "bg-jaune",
  SILVER: "bg-rose",
  SOUTIEN: "bg-rose",
  COMMUNAUTE: "bg-rose",
};

interface SponsorCardProps {
  sponsor: SponsorPublic;
  /** Platinum cards are larger (RG-223). */
  large?: boolean;
}

export default function SponsorCard({ sponsor, large = false }: SponsorCardProps) {
  return (
    <Link
      href={`/sponsors/${sponsor.slug}`}
      className="group block overflow-hidden rounded-2xl bg-blanc shadow-card transition-transform hover:-translate-y-1"
    >
      <div className={`h-2 ${LEVEL_BANNER[sponsor.level]}`} />
      <div className={`flex flex-col items-center justify-center gap-3 ${large ? "p-8" : "p-6"}`}>
        <div className={`relative flex items-center justify-center ${large ? "h-32 w-full" : "h-20 w-full"}`}>
          {sponsor.logoUrl ? (
            <Image
              src={sponsor.logoUrl}
              alt={sponsor.name}
              fill
              className="object-contain"
              sizes={large ? "267px" : "200px"}
            />
          ) : (
            <span className={`font-bold text-noir ${large ? "text-3xl" : "text-xl"}`}>
              {sponsor.name}
            </span>
          )}
        </div>
        {sponsor.logoUrl && (
          <span className={`font-bold text-noir ${large ? "text-2xl" : "text-lg"}`}>
            {sponsor.name}
          </span>
        )}
      </div>
    </Link>
  );
}
