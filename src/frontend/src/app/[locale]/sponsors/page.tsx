import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSponsors } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import SponsorWall from "@/components/sponsors/SponsorWall";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  return {
    title: t("title"),
    description: t("description"),
    ...(await pageMetadata(locale, "/sponsors")),
  };
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

        <p className="mx-auto mt-4 max-w-[640px] text-center text-gris">{t("intro")}</p>

        {sponsors.length === 0 ? (
          <p className="mt-12 text-center text-lg text-gris">{t("empty")}</p>
        ) : (
          <div className="mt-4">
            <SponsorWall sponsors={sponsors} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}
