import type { FastifyRequest } from "fastify";

/** Prefix `@fastify/static` serves the uploaded files under. */
export const UPLOADS_PREFIX = "/uploads/";

/** API budget, per IP and per minute. */
export const API_RATE_LIMIT_MAX = 200;

/**
 * Static uploads budget, per IP and per minute (#469).
 *
 * Opening a PDF in the browser does not fetch it once: the viewer asks for it
 * in byte ranges, and every `Range` request costs a token here. A 13 MB
 * brochure therefore drained the 200-request API budget and answered
 * `429 Too Many Requests` halfway through the file.
 *
 * The ceiling stays — bandwidth abuse is the reverse proxy's problem, not this
 * plugin's — but it is now high enough for a PDF viewer, an image-heavy page,
 * and several visitors sharing one NAT address.
 */
export const UPLOADS_RATE_LIMIT_MAX = 1000;

function isUpload(request: FastifyRequest) {
  return request.url.startsWith(UPLOADS_PREFIX);
}

/**
 * Two budgets, two buckets: reading a brochure must not spend what the site's
 * own API calls need, and vice versa. A shared counter with two ceilings would
 * still let the PDF lock the API out for a minute.
 */
export const rateLimitOptions = {
  timeWindow: "1 minute",
  max: (request: FastifyRequest) =>
    isUpload(request) ? UPLOADS_RATE_LIMIT_MAX : API_RATE_LIMIT_MAX,
  keyGenerator: (request: FastifyRequest) =>
    isUpload(request) ? `uploads:${request.ip}` : request.ip,
  addHeadersOnExceeding: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
  },
};
