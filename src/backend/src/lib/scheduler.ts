import type { FastifyBaseLogger } from "fastify";
import cron from "node-cron";

import { rotateFeaturedSpeakers } from "./featured-speakers.js";

// 1 AM Paris time — the cron expression is evaluated in that timezone, so it
// holds across DST instead of drifting between 2 AM and 3 AM local (#214).
const FEATURED_ROTATION_CRON = "0 1 * * *";
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
        const result = await rotateFeaturedSpeakers();
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

  log.info({ cron: FEATURED_ROTATION_CRON, timezone: TIMEZONE }, "Scheduled tasks started");
}
