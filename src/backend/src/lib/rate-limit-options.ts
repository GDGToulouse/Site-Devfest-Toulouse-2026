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

/** Sign-in, sign-up, password reset: per IP and per minute. */
export const AUTH_RATE_LIMIT_MAX = 10;

/**
 * The MCP connector's OAuth endpoints and discovery documents (#514), per IP
 * and per minute. An agent connecting reads several discovery documents, then
 * authorizes, consents, exchanges a code and refreshes — and hosted agents
 * reach us from shared egress addresses. The sign-in budget would lock out the
 * second person connecting from the same agent within a minute. Passwords are
 * not tried here: these endpoints take codes and tokens, not credentials.
 */
export const OAUTH_RATE_LIMIT_MAX = 60;

export function isOAuthRequest(url: string): boolean {
  const path = url.split("?")[0];
  return path.startsWith("/api/auth/oauth2/") || path.startsWith("/.well-known/") || path === "/api/auth/jwks"
    || path.startsWith("/api/auth/.well-known/");
}

/** Route-level budget for everything handed to better-auth. */
export const authRateLimit = {
  timeWindow: "1 minute",
  max: (request: FastifyRequest) => (isOAuthRequest(request.url) ? OAUTH_RATE_LIMIT_MAX : AUTH_RATE_LIMIT_MAX),
  keyGenerator: (request: FastifyRequest) => (isOAuthRequest(request.url) ? `oauth:${request.ip}` : `auth:${request.ip}`),
};

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

/**
 * Invitations a sponsor space may send, per sponsor and per hour (#524). Each
 * one mails any address from the DevFest's SMTP server, so the per-IP budget
 * is not enough: a RESPONSABLE could still flood strangers' inboxes. Twenty an
 * hour is well above a company inviting its team.
 */
export const TEAM_INVITE_RATE_LIMIT_MAX = 20;

/**
 * Route-level budget for POST /api/sponsor-space/:sponsorId/team. Counted in
 * preHandler, after the sponsor guard: on the default onRequest hook an
 * anonymous caller could spend a sponsor's budget and block its invitations.
 */
export const teamInviteRateLimit = {
  hook: "preHandler" as const,
  timeWindow: "1 hour",
  max: TEAM_INVITE_RATE_LIMIT_MAX,
  keyGenerator: (request: FastifyRequest) =>
    `team-invite:${(request.params as { sponsorId?: string }).sponsorId}`,
};
