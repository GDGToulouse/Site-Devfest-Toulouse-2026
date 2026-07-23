import type { SponsorCardSize } from "./SponsorCard";

// Centred level header (#323): the offer name framed by two symmetric gradient
// rules in the offer's own colour. No vertical bar. The name size follows the
// offer's band, so higher tiers read larger — all derived from the tier.
const NAME_SIZE: Record<SponsorCardSize, string> = {
  xl: "text-[34px] leading-tight",
  lg: "text-[28px] leading-tight",
  md: "text-2xl",
  sm: "text-xl",
};

interface TierHeaderProps {
  title: string;
  color: string;
  size: SponsorCardSize;
}

export default function TierHeader({ title, color, size }: TierHeaderProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <span
        aria-hidden="true"
        className="h-[2px] flex-[0_1_200px] rounded-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color})` }}
      />
      <h2 className={`whitespace-nowrap text-center font-bold text-noir ${NAME_SIZE[size]}`}>{title}</h2>
      <span
        aria-hidden="true"
        className="h-[2px] flex-[0_1_200px] rounded-[2px]"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </div>
  );
}
