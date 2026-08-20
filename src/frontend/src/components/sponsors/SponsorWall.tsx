import type { SponsorPublic } from "@/lib/types";
import SponsorCard, { bandForLogoScale } from "@/components/sponsors/SponsorCard";
import TierHeader from "@/components/sponsors/TierHeader";

// Group sponsors by tier, preserving the server's rank-descending order (#321).
export function groupByTier(sponsors: SponsorPublic[]) {
  const groups: { key: string; tier: SponsorPublic["tier"]; items: SponsorPublic[] }[] = [];
  for (const s of sponsors) {
    let group = groups.find((g) => g.key === s.tier.key);
    if (!group) {
      group = { key: s.tier.key, tier: s.tier, items: [] };
      groups.push(group);
    }
    group.items.push(s);
  }
  return groups;
}

interface SponsorWallProps {
  sponsors: SponsorPublic[];
  locale: string;
}

// The tier-grouped logo wall, shared by /sponsors (featured edition) and the
// sponsors section of a past edition page (#370). Both endpoints return the
// same payload — values frozen per edition (#375) — so one component serves
// the live wall and the archive alike.
export default function SponsorWall({ sponsors, locale }: SponsorWallProps) {
  return (
    <>
      {groupByTier(sponsors).map(({ key, tier, items }) => {
        const size = bandForLogoScale(tier.logoScale);
        const title = locale === "en" ? tier.nameEn : tier.nameFr;
        return (
          <section key={key} className="mt-[52px] first:mt-10">
            <TierHeader title={title} color={tier.color} size={size} />
            <div className="mt-6 flex flex-wrap items-stretch justify-center gap-[18px]">
              {items.map((s) => (
                <SponsorCard key={s.id} sponsor={s} size={size} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
