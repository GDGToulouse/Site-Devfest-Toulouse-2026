import type { FastifyServerOptions } from "fastify";

/**
 * Ceiling on a single route parameter, in characters (#467).
 *
 * Fastify defaults to 100 and answers `414 URI Too Long` above it — before the
 * handler runs, so no route can opt out. Six conference pages hit that in
 * production: slugs are derived from talk titles, and the historical import
 * produced titles long enough to reach 168 characters. The frontend correctly
 * refuses to read a 414 as "not found" (#345), so those pages rendered a 500,
 * and the sitemap kept feeding them to Google.
 *
 * 512 is three times the longest slug in the data. Not unbounded: the value
 * exists to bound the router's work, and a slug that long is a data problem
 * worth surfacing rather than serving.
 */
export const MAX_PARAM_LENGTH = 512;

/**
 * Options shared by the real server and by the tests that probe its routing.
 *
 * `logger` is deliberately absent: the server configures its own level, and
 * tests want silence.
 *
 * trustProxy: required behind Traefik/Coolify so request.ip and
 * request.protocol reflect the X-Forwarded-* headers set by the reverse proxy.
 */
export const serverOptions: FastifyServerOptions = {
  trustProxy: true,
  // Under `routerOptions`, not at the top level: Fastify 5 accepts both but
  // warns FSTDEP022 on the flat form, which it drops in 6.
  routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
};
