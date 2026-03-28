import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { localizedField } from "@/lib/i18n-helpers";
import type { TicketTier } from "@/lib/types";

interface TicketingSectionProps {
  tiers: TicketTier[];
  locale: string;
}

export default function TicketingSection({ tiers, locale }: TicketingSectionProps) {
  const t = useTranslations("home.ticketing");

  if (tiers.length === 0) return null;

  return (
    <section className="px-6 py-16 lg:py-24 bg-blanc-casse">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl lg:text-5xl font-bold text-noir mb-10">
          {t("title")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {tiers.map((tier) => {
            const name = localizedField(tier, "name", locale);
            const isSoldOut = tier.status === "SOLD_OUT";

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
                      ? "bg-rouge/10 text-rouge"
                      : "bg-malachite/10 text-malachite"
                  }`}
                >
                  {isSoldOut ? t("soldOut") : t("available")}
                </span>
                {tier.externalUrl && !isSoldOut && (
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

        <Link
          href="/billetterie"
          className="text-link hover:underline font-bold text-lg"
        >
          {t("viewAll")}
        </Link>
      </div>
    </section>
  );
}
