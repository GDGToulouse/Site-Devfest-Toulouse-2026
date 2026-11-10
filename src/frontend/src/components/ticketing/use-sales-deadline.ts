"use client";

import { useEffect, useState } from "react";
import type { TicketTier } from "@/lib/types";

export interface SalesDeadline {
  /** Milliseconds left, or null before the first tick in the browser. */
  remainingMs: number | null;
  /** True once the deadline has passed, as seen by the browser. */
  isClosed: boolean;
}

// The registration deadline (#822), on the browser's clock. The ticketing
// pages are cached: a page rendered at 23:50 would still sell at 23:56. So the
// tiers close here, at the second, whatever the server said. Before the first
// tick, nothing is known: the server's statuses stand, which keeps the first
// render identical to the server's.
export function useSalesDeadline(salesEndAt: string | null | undefined): SalesDeadline {
  const endMs = salesEndAt ? Date.parse(salesEndAt) : NaN;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (Number.isNaN(endMs)) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endMs) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endMs]);

  if (Number.isNaN(endMs) || now === null) return { remainingMs: null, isClosed: false };
  return { remainingMs: Math.max(0, endMs - now), isClosed: now >= endMs };
}

export function effectiveStatus(tier: TicketTier, isClosed: boolean): TicketTier["status"] {
  return isClosed ? "CLOSED" : tier.status;
}

/** Days, hours, minutes and seconds in `ms`, for the countdown. */
export function splitDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
