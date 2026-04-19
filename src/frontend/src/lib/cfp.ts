import type { CfpSettings } from "./types";

/**
 * URL to expose for the "Submit a talk" CTA — null means hide the button.
 *
 * Rules (single source of truth, see /admin > Edition > CFP tab):
 *   - isOpen must be true (admin kill switch / pre-announcement toggle)
 *   - sessionizeUrl must be set
 *   - if closeDate is set, "now" must be on or before that date (inclusive,
 *     end-of-day). Past closeDate auto-hides the CTA so we don't have to
 *     remember to flip the toggle the morning after the CFP closes; if we
 *     decide to extend, simply pushing the date forward re-opens it.
 *   - openDate is purely informative on the /proposer-un-talk page; it
 *     does NOT gate the CTA, so we can use isOpen to tease the upcoming
 *     CFP before the actual opening date.
 */
export function getCfpCtaUrl(cfp: CfpSettings | null): string | null {
  if (!cfp || !cfp.isOpen || !cfp.sessionizeUrl) return null;

  if (cfp.closeDate) {
    const close = new Date(cfp.closeDate);
    // Treat closeDate as the last full day the CFP is open — bump to end of
    // day in the user's local time so 23:59 still shows the CTA.
    close.setHours(23, 59, 59, 999);
    if (Date.now() > close.getTime()) return null;
  }

  return cfp.sessionizeUrl;
}
