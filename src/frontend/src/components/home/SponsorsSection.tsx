import { getLocale, getTranslations } from "next-intl/server";

import type { SponsorPublic } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import SponsorCard, { bandForLogoScale } from "@/components/sponsors/SponsorCard";
import TierHeader from "@/components/sponsors/TierHeader";
import { surfaceBgClass, type SectionSurface } from "./section-surface";

interface SponsorsSectionProps {
  sponsors: SponsorPublic[];
  surface?: SectionSurface;
}

// Sponsors are fetched by the page so it can compute the section alternation
// over the visible sections (#135).
export default async function SponsorsSection({ sponsors, surface = "blanc" }: SponsorsSectionProps) {
  const t = await getTranslations("home.sponsors");
  const locale = await getLocale();

  // Hidden when no sponsor is published (US-212).
  if (sponsors.length === 0) return null;

  // Group by tier, preserving the server's rank-descending order (#321).
  const byTier: { key: string; tier: SponsorPublic["tier"]; items: SponsorPublic[] }[] = [];
  for (const s of sponsors) {
    let group = byTier.find((g) => g.key === s.tier.key);
    if (!group) {
      group = { key: s.tier.key, tier: s.tier, items: [] };
      byTier.push(group);
    }
    group.items.push(s);
  }

  return (
    <section className={`section-y relative overflow-hidden px-6 ${surfaceBgClass(surface)}`}>
      {/* Croix occitane decoration (top-right). Placeholder geometric mark
          until the brand asset is provided; kept subtle and decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rotate-[22deg] opacity-[0.06]"
      >
        <svg viewBox="0 0 100 100" fill="currentColor" className="h-full w-full text-terre-cuite">
          <path d="M40 0h20v40h40v20H60v40H40V60H0V40h40z" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="section-title flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-noir lg:text-4xl">{t("title")}</h2>
          <Link
            href="/devenir-sponsor"
            className="inline-block rounded-[12px] bg-bleu px-6 py-3 font-bold text-blanc transition-colors hover:bg-bleu/90"
          >
            {t("cta")}
          </Link>
        </div>

        <div className="mt-6 space-y-10">
          {byTier.map(({ key, tier, items }) => {
            const size = bandForLogoScale(tier.logoScale);
            const title = locale === "en" ? tier.nameEn : tier.nameFr;
            return (
              <div key={key}>
                <TierHeader title={title} color={tier.color} size={size} />
                <div className="mt-5 flex flex-wrap items-stretch justify-center gap-[18px]">
                  {items.map((s) => (
                    <SponsorCard key={s.id} sponsor={s} size={size} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link href="/sponsors" className="font-bold text-bleu hover:underline">
            {t("seeAll")}
          </Link>
        </div>
      </div>
    </section>
  );
}
