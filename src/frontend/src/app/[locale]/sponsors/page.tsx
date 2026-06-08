import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSponsors } from "@/lib/api";
import type { SponsorLevel } from "@/lib/types";
import Breadcrumb from "@/components/Breadcrumb";
import SponsorCard from "@/components/sponsors/SponsorCard";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/sponsors`,
      languages: { fr: "/fr/sponsors", en: "/en/sponsors", "x-default": "/fr/sponsors" },
    },
  };
}

const LEVEL_ORDER: SponsorLevel[] = ["PLATINUM", "GOLD", "SILVER", "SOUTIEN", "COMMUNAUTE"];

export default async function SponsorsPage() {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  const [edition, sponsors] = await Promise.all([getCurrentEdition(), getSponsors()]);
  const year = edition?.year ?? new Date().getFullYear();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/sponsors` },
  ];

  // Group sponsors by level, keeping the importance order.
  const byLevel = LEVEL_ORDER.map((level) => ({
    level,
    items: sponsors.filter((s) => s.level === level),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
            {t("heading", { year })}
          </h1>
          <Link
            href="/devenir-sponsor"
            className="inline-block rounded-[12px] bg-bleu px-6 py-3 font-bold text-blanc transition-colors hover:bg-bleu/90"
          >
            {t("becomeSponsorCta")}
          </Link>
        </div>

        {byLevel.length === 0 ? (
          <p className="mt-12 text-lg text-gris">{t("empty")}</p>
        ) : (
          <div className="mt-10 space-y-12">
            {byLevel.map(({ level, items }) => (
              <section key={level}>
                <h2 className="mb-6 text-2xl font-bold text-noir">{t(`level.${level}`)}</h2>
                <div
                  className={
                    level === "PLATINUM"
                      ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
                  }
                >
                  {items.map((s) => (
                    <SponsorCard key={s.id} sponsor={s} large={level === "PLATINUM"} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
