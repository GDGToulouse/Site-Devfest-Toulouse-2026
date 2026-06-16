import { getTranslations } from "next-intl/server";

import { getSponsors } from "@/lib/api";
import type { SponsorLevel } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import SponsorCard from "@/components/sponsors/SponsorCard";

const LEVEL_ORDER: SponsorLevel[] = ["PLATINUM", "GOLD", "SILVER", "SOUTIEN", "COMMUNAUTE"];

export default async function SponsorsSection() {
  const [t, sponsors] = await Promise.all([
    getTranslations("home.sponsors"),
    getSponsors(),
  ]);

  // Hidden when no sponsor is published (US-212).
  if (sponsors.length === 0) return null;

  const byLevel = LEVEL_ORDER.map((level) => ({
    level,
    items: sponsors.filter((s) => s.level === level),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="relative overflow-hidden px-6 py-10 lg:py-14">
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-noir lg:text-4xl">{t("title")}</h2>
          <Link
            href="/devenir-sponsor"
            className="inline-block rounded-[12px] bg-bleu px-6 py-3 font-bold text-blanc transition-colors hover:bg-bleu/90"
          >
            {t("cta")}
          </Link>
        </div>

        <div className="space-y-8">
          {byLevel.map(({ level, items }) => (
            <div
              key={level}
              className={
                level === "PLATINUM"
                  ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
              }
            >
              {items.map((s) => (
                <SponsorCard key={s.id} sponsor={s} large={level === "PLATINUM"} logoOnly />
              ))}
            </div>
          ))}
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
