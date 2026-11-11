"use client";

import { useTranslations } from "next-intl";

import { localizedField } from "@/lib/i18n-helpers";
import type { TicketTier } from "@/lib/types";
import TicketSalesCountdown from "./TicketSalesCountdown";
import { effectiveStatus, useSalesDeadline } from "./use-sales-deadline";

// The tiers of /billetterie. A client component since #822: they close in the
// browser at the registration deadline, the page being cached.
export default function TicketTierGrid({
  tiers,
  locale,
  salesEndAt,
}: {
  tiers: TicketTier[];
  locale: string;
  salesEndAt: string | null;
}) {
  const t = useTranslations("ticketing");
  const tSales = useTranslations("ticketSales");
  const clock = useSalesDeadline(salesEndAt);
  // A page rendered after the deadline is closed from its first paint.
  const isClosed = clock.isClosed || tiers.some((tier) => tier.status === "CLOSED");
  const allSoldOut = !isClosed && tiers.every((tier) => tier.status === "SOLD_OUT");

  return (
    <>
      {salesEndAt && (
        <div className="mt-8">
          <TicketSalesCountdown salesEndAt={salesEndAt} deadline={{ ...clock, isClosed }} />
        </div>
      )}

      {allSoldOut && <p className="mt-6 text-lg font-bold text-rouge">{t("allSoldOut")}</p>}

      <div
        className={`mt-10 grid grid-cols-1 ${
          tiers.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2"
        } ${
          tiers.length === 1
            ? "lg:grid-cols-1"
            : tiers.length === 2
              ? "lg:grid-cols-2"
              : "lg:grid-cols-3"
        } gap-8 justify-center mx-auto`}
        style={{ maxWidth: tiers.length < 3 ? `${tiers.length * 380}px` : undefined }}
      >
        {tiers.map((tier) => {
          const name = localizedField(tier, "name", locale);
          const status = effectiveStatus(tier, isClosed);
          const isAvailable = status === "AVAILABLE";
          const isSoldOut = status === "SOLD_OUT";
          const isComingSoon = status === "COMING_SOON";
          const isTierClosed = status === "CLOSED";

          return (
            <div
              key={tier.id}
              data-status={status}
              className={`bg-blanc rounded-3xl shadow-card p-8 flex flex-col items-center text-center ${
                isTierClosed ? "opacity-60 grayscale" : isSoldOut ? "opacity-70" : ""
              }`}
            >
              <h2 className="text-2xl lg:text-[32px] font-bold text-noir">{name}</h2>
              <p className={`mt-4 text-5xl lg:text-[64px] font-bold ${isSoldOut ? "text-gris line-through" : "text-noir"}`}>
                {tier.price}€
              </p>
              <span
                className={`mt-4 inline-block px-4 py-1 rounded-full text-sm font-bold ${
                  isTierClosed
                    ? "bg-noir/10 text-noir"
                    : isSoldOut
                      ? "bg-rouge/10 text-bismarck"
                      : isComingSoon
                        ? "bg-bleu/10 text-bleu"
                        : "bg-malachite/10 text-[#0A6B4B]"
                }`}
              >
                {isTierClosed
                  ? tSales("status")
                  : isSoldOut
                    ? t("soldOut")
                    : isComingSoon
                      ? t("comingSoon")
                      : t("available")}
              </span>
              {tier.externalUrl && isAvailable && (
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
    </>
  );
}
