"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatEventTime } from "@/lib/datetime";
import { nextSlot, parseSimulatedNow } from "@/lib/next-slot";
import type { ScheduleRow } from "@/lib/schedule";

// How often the target is worked out again: a slot starts every quarter of an
// hour at most, and the button must not lead to one already under way.
const REFRESH_MS = 30_000;

/**
 * "Next slot · 11:00", floating at the bottom right, on the day only (#575).
 * Decided in the browser: the programme page is cached for an hour, the clock
 * that matters is the visitor's.
 */
export default function NextSlotButton({ rows }: { rows: ScheduleRow[] }) {
  const t = useTranslations("programme");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // `?now=` rehearses the button before the day, beta and production included.
    const simulated = parseSimulatedNow(new URLSearchParams(window.location.search).get("now"));
    const tick = () => setNow(simulated ?? new Date());
    tick();
    if (simulated) return;
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const target = now ? nextSlot(rows, now) : null;
  if (!target) return null;

  function goToSlot() {
    // Both views are in the page, one of them hidden: the row to reach is the
    // one actually laid out.
    const row = [...document.querySelectorAll<HTMLElement>(`[data-slot="${target!.key}"]`)].find(
      (el) => el.getClientRects().length > 0,
    );
    if (!row) return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: isReduced ? "auto" : "smooth", block: "start" });
    // Announced by a screen reader, without a second jump.
    row.focus({ preventScroll: true });
  }

  return (
    <>
      {/* Room for the button under the last row, so it never covers it. */}
      <div aria-hidden className="no-print h-20" />
      <button
        type="button"
        onClick={goToSlot}
        className="no-print fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 min-h-11 rounded-full bg-bleu px-5 py-3 font-bold text-blanc shadow-lg transition-colors hover:bg-bleu/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu"
      >
        {t("nextSlot", { time: formatEventTime(target.startsAt) })}
      </button>
    </>
  );
}
