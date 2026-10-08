import type { FastifyBaseLogger } from "fastify";
import cron from "node-cron";

import { rotateFeaturedSpeakers } from "./featured-speakers.js";
import { runInContext, systemContext } from "./request-context.js";
import { AUDIT_RETENTION_MONTHS, purgeExpiredAuditLog } from "./audit-purge.js";
import { disableExpiredTestModes } from "./talk-feedback-test-mode.js";
import { switchToEventDay } from "./event-day-switch.js";

// 1 AM Paris time — the cron expression is evaluated in that timezone, so it
// holds across DST instead of drifting between 2 AM and 3 AM local (#214).
const FEATURED_ROTATION_CRON = "0 1 * * *";
const AUDIT_PURGE_CRON = "0 3 * * *";
// Midnight Paris time, when the event day starts and real votes open (#566).
const FEEDBACK_TEST_MODE_CRON = "0 0 * * *";
// Every quarter of an hour past midnight, Paris time (#585): a redeploy at
// midnight would otherwise skip the day's switch. Not all day long, so a team
// that moves the status back by hand on the day is not overruled.
const EVENT_DAY_CRON = "0,15,30,45 0 * * *";
const TIMEZONE = "Europe/Paris";

/**
 * Register the backend's scheduled tasks. Called once at boot.
 *
 * Note: this runs in-process. If the backend is ever scaled to several
 * replicas, each one would fire the job. The rotation is harmless in that case
 * (the last write simply wins) but a distributed lock would be needed for tasks
 * where that is not true.
 */
export function startScheduledTasks(log: FastifyBaseLogger): void {
  cron.schedule(
    FEATURED_ROTATION_CRON,
    async () => {
      try {
        // No request here: open a context so the rotation is filed as the
        // system's doing rather than left unattributed (#513).
        const result = await runInContext(
          systemContext("Rotation des speakers mis en avant"),
          rotateFeaturedSpeakers,
        );
        if (result.edition === null) {
          log.warn("Featured speakers rotation skipped: no featured edition");
          return;
        }
        log.info(
          { edition: result.edition, count: result.featured.length, speakers: result.featured },
          "Featured speakers rotated",
        );
      } catch (err) {
        // A failing cron must never take the server down.
        log.error({ err }, "Featured speakers rotation failed");
      }
    },
    { name: "featured-speakers-rotation", timezone: TIMEZONE, noOverlap: true },
  );

  // Daily rather than monthly: a missed run (a redeploy at 3 AM) then costs a
  // day of extra history, not a month. Harmless on several replicas too — a
  // second delete finds nothing left.
  cron.schedule(
    AUDIT_PURGE_CRON,
    async () => {
      try {
        const purged = await purgeExpiredAuditLog();
        log.info({ purged, retentionMonths: AUDIT_RETENTION_MONTHS }, "Audit log purged");
      } catch (err) {
        log.error({ err }, "Audit log purge failed");
      }
    },
    { name: "audit-log-purge", timezone: TIMEZONE, noOverlap: true },
  );

  // A feedback test mode left on is switched off when real voting opens, and
  // the votes of the trial go with it (#566). Every night, not only on the
  // day: a run missed at midnight (a redeploy) is caught by the next. Votes
  // cast meanwhile are real whatever the flag, so a late run harms nothing.
  cron.schedule(
    FEEDBACK_TEST_MODE_CRON,
    async () => {
      try {
        const switchedOff = await runInContext(
          systemContext("Fin du mode test des avis"),
          () => disableExpiredTestModes(),
        );
        if (switchedOff.length > 0) log.info({ switchedOff }, "Feedback test mode switched off");
      } catch (err) {
        log.error({ err }, "Feedback test mode switch-off failed");
      }
    },
    { name: "feedback-test-mode-off", timezone: TIMEZONE, noOverlap: true },
  );

  // The home page goes to "Jour J" on its own on the first day (#585).
  cron.schedule(
    EVENT_DAY_CRON,
    async () => {
      try {
        const switched = await runInContext(systemContext("Passage automatique en Jour J"), () => switchToEventDay());
        if (switched.length > 0) log.info({ switched }, "Editions switched to EVENT_DAY");
      } catch (err) {
        log.error({ err }, "Event day switch failed");
      }
    },
    { name: "event-day-switch", timezone: TIMEZONE, noOverlap: true },
  );

  log.info(
    { cron: [FEATURED_ROTATION_CRON, AUDIT_PURGE_CRON, FEEDBACK_TEST_MODE_CRON, EVENT_DAY_CRON], timezone: TIMEZONE },
    "Scheduled tasks started",
  );
}
