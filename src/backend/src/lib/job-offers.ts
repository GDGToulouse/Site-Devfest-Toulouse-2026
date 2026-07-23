// Job-offer business rules (#251).
//
// The per-tier quota (how many offers a sponsor may publish) moved onto
// SponsorTier.jobOfferQuota with #317 — read it from the sponsor's tier instead
// of a hard-coded table.

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
