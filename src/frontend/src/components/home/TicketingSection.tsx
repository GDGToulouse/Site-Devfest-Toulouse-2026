import { useTranslations } from "next-intl";

import { localizedField } from "@/lib/i18n-helpers";
import type { TicketTier } from "@/lib/types";

interface TicketingSectionProps {
  tiers: TicketTier[];
  locale: string;
}

export default function TicketingSection({ tiers, locale }: TicketingSectionProps) {
  const t = useTranslations("home.ticketing");

  if (tiers.length === 0) return null;

  const billetwebUrl = tiers.find((t) => t.externalUrl)?.externalUrl || null;

  // When the row isn't full, cap the column count so the cards stay
  // centred instead of clinging to the left edge of a 3-column grid.
  // Cards are also given a fixed max-width so the centred row keeps
  // the same card size as a full row.
  const lgCols =
    tiers.length === 1 ? "lg:grid-cols-1" : tiers.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  const smCols = tiers.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2";

  return (
    <section className="px-6 py-16 lg:py-24 bg-blanc-casse">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl lg:text-5xl font-bold text-noir mb-10">
          {t("title")}
        </h2>

        <div
          className={`grid grid-cols-1 ${smCols} ${lgCols} gap-6 mb-10 justify-center mx-auto`}
          style={{ maxWidth: tiers.length < 3 ? `${tiers.length * 360}px` : undefined }}
        >
          {tiers.map((tier) => {
            const name = localizedField(tier, "name", locale);
            const isAvailable = tier.status === "AVAILABLE";
            const isSoldOut = tier.status === "SOLD_OUT";
            const isComingSoon = tier.status === "COMING_SOON";

            return (
              <div
                key={tier.id}
                className="bg-blanc rounded-3xl shadow-card p-8 flex flex-col items-center"
              >
                <h3 className="text-2xl font-bold text-noir">{name}</h3>
                <p className="mt-4 text-4xl font-bold text-noir">
                  {tier.price}€
                </p>
                <span
                  className={`mt-4 inline-block px-4 py-1 rounded-full text-sm font-bold ${
                    isSoldOut
                      ? "bg-rouge/10 text-bismarck"
                      : isComingSoon
                        ? "bg-bleu/10 text-bleu"
                        : "bg-malachite/10 text-[#0A6B4B]"
                  }`}
                >
                  {isSoldOut ? t("soldOut") : isComingSoon ? t("comingSoon") : t("available")}
                </span>
                {tier.externalUrl && isAvailable && (
                  <a
                    href={tier.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 px-6 py-2 rounded-[12px] bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors"
                  >
                    {t("buy")}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {billetwebUrl && (
          <a
            href={billetwebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline font-bold text-lg"
          >
            {t("viewAll")}
          </a>
        )}
      </div>
    </section>
  );
}
