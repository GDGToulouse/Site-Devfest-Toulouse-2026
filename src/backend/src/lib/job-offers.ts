// Job-offer business rules (#251).

// How many job offers a sponsor may publish, by level. A stricter cap for
// lower tiers keeps the perk proportionate to the sponsorship.
const OFFER_QUOTA: Record<string, number> = {
  PLATINUM: 4,
  GOLD: 2,
  SILVER: 1,
  SOUTIEN: 1,
  COMMUNAUTE: 1,
};

export function offerQuotaForLevel(level: string): number {
  return OFFER_QUOTA[level] ?? 1;
}

// Offers stay visible until one month after the event. We anchor on the
// edition's end date (fall back to its start date), so the cut-off follows the
// real event, not the calendar. A null date means the event isn't scheduled
// yet — nothing to hide.
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function offersVisibilityCutoff(
  edition: { startDate: Date | null; endDate: Date | null },
): Date | null {
  const anchor = edition.endDate ?? edition.startDate;
  if (!anchor) return null;
  return new Date(anchor.getTime() + ONE_MONTH_MS);
}

// True while the sponsor's offers should still be shown publicly.
export function areOffersVisible(
  edition: { startDate: Date | null; endDate: Date | null },
  now: Date = new Date(),
): boolean {
  const cutoff = offersVisibilityCutoff(edition);
  if (!cutoff) return true;
  return now.getTime() <= cutoff.getTime();
}
