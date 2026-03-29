import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentTicketTiers } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import Breadcrumb from "@/components/Breadcrumb";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ticketing");
  return {
    title: t("pageTitle"),
    description: t("description"),
  };
}

export default async function TicketingPage() {
  const locale = await getLocale();
  const t = await getTranslations("ticketing");
  const tiers = await getCurrentTicketTiers();

  const allSoldOut = tiers.length > 0 && tiers.every((t) => t.status === "SOLD_OUT");

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
            {allSoldOut && (
              <p className="mt-6 text-lg font-bold text-rouge">{t("allSoldOut")}</p>
            )}

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {tiers.map((tier) => {
                const name = localizedField(tier, "name", locale);
                const isSoldOut = tier.status === "SOLD_OUT";

                return (
                  <div
                    key={tier.id}
                    className={`bg-blanc rounded-3xl shadow-card p-8 flex flex-col items-center text-center ${
                      isSoldOut ? "opacity-70" : ""
                    }`}
                  >
                    <h2 className="text-2xl lg:text-[32px] font-bold text-noir">{name}</h2>
                    <p className={`mt-4 text-5xl lg:text-[64px] font-bold ${isSoldOut ? "text-gris line-through" : "text-noir"}`}>
                      {tier.price}€
                    </p>
                    <span
                      className={`mt-4 inline-block px-4 py-1 rounded-full text-sm font-bold ${
                        isSoldOut
                          ? "bg-rouge/10 text-bismarck"
                          : "bg-malachite/10 text-[#0A6B4B]"
                      }`}
                    >
                      {isSoldOut ? t("soldOut") : t("available")}
                    </span>
                    {tier.externalUrl && !isSoldOut && (
                      <a
                        href={tier.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 px-8 py-3 rounded-[12px] bg-bleu text-blanc font-bold text-lg hover:bg-bleu/90 transition-colors"
                      >
                        {t("buy")}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-10 text-center text-gris text-sm">
              {t("externalNote")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
