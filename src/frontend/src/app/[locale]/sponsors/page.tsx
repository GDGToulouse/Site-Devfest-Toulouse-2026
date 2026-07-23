import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSponsors } from "@/lib/api";
import type { SponsorPublic } from "@/lib/types";
import Breadcrumb from "@/components/Breadcrumb";
import SponsorCard, { sizeForLogoScale } from "@/components/sponsors/SponsorCard";
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

// Group sponsors by tier, preserving the server's rank-descending order (#321).
function groupByTier(sponsors: SponsorPublic[]) {
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

export default async function SponsorsPage() {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  const [edition, sponsors] = await Promise.all([getCurrentEdition(), getSponsors()]);
  const year = edition?.year ?? new Date().getFullYear();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/sponsors` },
  ];

  const byTier = groupByTier(sponsors);

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

        {byTier.length === 0 ? (
          <p className="mt-12 text-lg text-gris">{t("empty")}</p>
        ) : (
          <div className="mt-10 space-y-12">
            {byTier.map(({ key, tier, items }) => {
              const size = sizeForLogoScale(tier.logoScale);
              const title = locale === "en" ? tier.nameEn : tier.nameFr;
              return (
                <section key={key}>
                  <h2 className="mb-6 text-2xl font-bold text-noir">{title}</h2>
                  <div
                    className={
                      size === "lg"
                        ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                        : "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
                    }
                  >
                    {items.map((s) => (
                      <SponsorCard key={s.id} sponsor={s} size={size} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
