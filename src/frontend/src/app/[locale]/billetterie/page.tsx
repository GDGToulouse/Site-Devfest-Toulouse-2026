import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getCurrentEdition, getCurrentTicketTiers } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import TicketTierGrid from "@/components/ticketing/TicketTierGrid";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ticketing");
  return {
    title: t("pageTitle"),
    description: t("description"),
    ...(await pageMetadata(locale, "/billetterie")),
  };
}

export default async function TicketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ticketing");
  const [tiers, edition] = await Promise.all([getCurrentTicketTiers(), getCurrentEdition()]);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/billetterie` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("pageTitle")}
        </h1>

        {tiers.length === 0 ? (
          <p className="mt-8 text-gris text-lg">{t("notOpenYet")}</p>
        ) : (
          <>
            <TicketTierGrid tiers={tiers} locale={locale} salesEndAt={edition?.ticketSalesEndAt ?? null} />

            <p className="mt-10 text-center text-gris text-sm">
              {t("externalNote")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
