"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { daysUntilEvent } from "@/lib/datetime";

// "In 23 days" under the date, in the last month (#576). Counted in the
// browser, not on the server: the home page is cached, and a figure rendered
// at 23:58 would still say "tomorrow" on the day itself.
export default function EventCountdown({ startDate }: { startDate: string }) {
  const t = useTranslations("home.hero.countdown");
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    setDays(daysUntilEvent(startDate, new Date()));
  }, [startDate]);

  if (days === null || days < 0) return null;

  return (
    <p className="hero-countdown text-noir">
      {days === 0 ? t("today") : days === 1 ? t("tomorrow") : t("days", { count: days })}
    </p>
  );
}
