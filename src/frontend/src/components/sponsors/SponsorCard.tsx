import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SponsorPublic } from "@/lib/types";

// Card size tier, derived from the offer's logoScale (#321). Higher offers get
// bigger logos, so the wall reads Platinum > Gold > Discovery > Soutien.
export type SponsorCardSize = "lg" | "md" | "sm";

// Map a tier's logoScale to a card size band. Tailwind can't take arbitrary
// heights cleanly, so we snap to three bands rather than a continuous scale.
export function sizeForLogoScale(logoScale: number): SponsorCardSize {
  if (logoScale >= 1) return "lg";
  if (logoScale >= 0.7) return "md";
  return "sm";
}

const SIZE_CLASSES: Record<SponsorCardSize, { pad: string; box: string; sizes: string; name: string; fallback: string }> = {
  lg: { pad: "p-8", box: "h-32", sizes: "267px", name: "text-2xl", fallback: "text-3xl" },
  md: { pad: "p-6", box: "h-24", sizes: "220px", name: "text-xl", fallback: "text-2xl" },
  sm: { pad: "p-6", box: "h-20", sizes: "200px", name: "text-lg", fallback: "text-xl" },
};

interface SponsorCardProps {
  sponsor: SponsorPublic;
  /** Logo size band, derived from the tier's logoScale (#321). */
  size?: SponsorCardSize;
  /** On the homepage only the logo is shown, without the name (RG-223). */
  logoOnly?: boolean;
}

export default function SponsorCard({ sponsor, size = "sm", logoOnly = false }: SponsorCardProps) {
  const showName = !logoOnly || !sponsor.logoUrl;
  const s = SIZE_CLASSES[size];
  return (
    <Link
      href={`/sponsors/${sponsor.slug}`}
      className="group block overflow-hidden rounded-2xl bg-blanc shadow-card transition-transform hover:-translate-y-1"
    >
      {/* Banner colour comes from the tier (#321) — a hex value, not a class. */}
      <div className="h-2" style={{ backgroundColor: sponsor.tier.color }} />
      <div className={`flex flex-col items-center justify-center gap-3 ${s.pad}`}>
        <div className={`relative flex items-center justify-center w-full ${s.box}`}>
          {sponsor.logoUrl ? (
            <Image
              src={sponsor.logoUrl}
              alt={sponsor.name}
              fill
              className="object-contain"
              sizes={s.sizes}
            />
          ) : (
            <span className={`font-bold text-noir ${s.fallback}`}>
              {sponsor.name}
            </span>
          )}
        </div>
        {sponsor.logoUrl && showName && (
          <span className={`font-bold text-noir ${s.name}`}>
            {sponsor.name}
          </span>
        )}
      </div>
    </Link>
  );
}
