import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SponsorPublic } from "@/lib/types";

// Size band derived from the offer's logoScale (#323). The catalogue seeds four
// distinct scales (1.0 / 0.8 / 0.6 / 0.5), so the wall reads Platinum > Gold >
// Discovery > Soutien as strictly decreasing cards. Nothing is hard-coded per
// level — everything flows from the tier.
export type SponsorCardSize = "xl" | "lg" | "md" | "sm";

export function bandForLogoScale(logoScale: number): SponsorCardSize {
  if (logoScale >= 1) return "xl";
  if (logoScale >= 0.75) return "lg";
  if (logoScale >= 0.55) return "md";
  return "sm";
}

// Per-band presentation. `card` is a fixed width so a flex-wrap row stays
// centred (incomplete rows included). The top band is a wide single card.
const BAND: Record<SponsorCardSize, { card: string; radius: string; box: string; sizes: string; name: string }> = {
  xl: { card: "w-full max-w-[440px]", radius: "rounded-[24px]", box: "h-28", sizes: "360px", name: "text-2xl" },
  lg: { card: "w-[250px]", radius: "rounded-[16px]", box: "h-24", sizes: "230px", name: "text-xl" },
  md: { card: "w-[230px]", radius: "rounded-[16px]", box: "h-20", sizes: "210px", name: "text-lg" },
  sm: { card: "w-[210px]", radius: "rounded-[16px]", box: "h-16", sizes: "190px", name: "text-base" },
};

interface SponsorCardProps {
  sponsor: SponsorPublic;
  /** Size band, derived from the tier's logoScale (#323). */
  size?: SponsorCardSize;
}

export default function SponsorCard({ sponsor, size = "sm" }: SponsorCardProps) {
  const b = BAND[size];
  return (
    <Link
      href={`/sponsors/${sponsor.slug}`}
      // Soft hover: shadow deepens, no bounce (#323).
      className={`group block overflow-hidden bg-blanc shadow-card border border-[rgba(29,29,27,0.08)] transition-shadow duration-200 hover:shadow-lg ${b.card} ${b.radius}`}
    >
      {/* Banner colour comes from the tier (#321) — a hex value, not a class. */}
      <div className="h-2" style={{ backgroundColor: sponsor.tier.color }} />
      <div className="flex flex-col items-center justify-center gap-3 p-6">
        {/* The name shows only as a fallback, when there is no logo to show (#355). */}
        <div className={`relative flex w-full items-center justify-center ${b.box}`}>
          {sponsor.logoUrl ? (
            <Image src={sponsor.logoUrl} alt={sponsor.name} fill className="object-contain" sizes={b.sizes} />
          ) : (
            <span className={`font-bold text-noir ${b.name}`}>{sponsor.name}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
