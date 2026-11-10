"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatEventDateTime } from "@/lib/datetime";
import { splitDuration, type SalesDeadline } from "./use-sales-deadline";

// "Registrations open until Monday 16 November at 23:55 — 5 d 03 h 12 min 05 s
// left" above the tickets (#822). The sentence with the date is in the server
// HTML; the ticking part only appears once the browser has its own clock.
const BOX = "mx-auto mb-8 flex w-fit flex-col items-center gap-1 rounded-2xl bg-blanc px-6 py-3 text-center text-noir shadow-card";

export default function TicketSalesCountdown({
  salesEndAt,
  deadline,
}: {
  salesEndAt: string;
  deadline: SalesDeadline;
}) {
  const t = useTranslations("ticketSales");
  const locale = useLocale();
  const date = formatEventDateTime(salesEndAt, locale);
  if (!date) return null;

  if (deadline.isClosed) {
    return (
      <p className={`${BOX} font-bold`} data-testid="ticket-sales-countdown">
        {t("closed", { date })}
      </p>
    );
  }

  const parts = deadline.remainingMs === null ? null : splitDuration(deadline.remainingMs);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <p className={BOX} data-testid="ticket-sales-countdown">
      <span>{t("until", { date })}</span>
      {parts && (
        <span role="timer" className="text-2xl font-bold text-terre-cuite tabular-nums">
          {t(parts.days > 0 ? "remaining" : "remainingToday", {
            days: parts.days,
            hours: pad(parts.hours),
            minutes: pad(parts.minutes),
            seconds: pad(parts.seconds),
          })}
        </span>
      )}
    </p>
  );
}
