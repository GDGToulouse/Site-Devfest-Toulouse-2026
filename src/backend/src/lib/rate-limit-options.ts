import { createHash, timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

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
 * Sign-in, sign-up, password reset: per IP and per minute. 60, not the 10 it
 * was: on event day some forty volunteers reach us through the venue's wifi,
 * one address for all, and the morning briefing ends with "sign in now"
 * (#642). Guessing one account's password is held by the budget below.
 */
export const AUTH_RATE_LIMIT_MAX = 60;

/** The same, per IP and per account named in the request: what holds a password guesser. */
export const AUTH_ACCOUNT_RATE_LIMIT_MAX = 10;

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

function accountNamed(request: FastifyRequest): string | null {
  const email = (request.body as { email?: unknown } | null | undefined)?.email;
  return typeof email === "string" && email.trim() !== "" ? email.trim().toLowerCase() : null;
}

/**
 * Per IP and per account (#642): a request that names an account (sign-in,
 * magic link, password reset) counts against that account from that address.
 * Requests naming no account pass: the per-IP budget already caps them.
 *
 * A preHandler, since the body is parsed by then, and built on
 * `createRateLimit`: the plugin's own `rateLimit()` handler skips a request
 * the route's limiter has already counted, so a second budget on the same
 * route never fired.
 */
export function authAccountRateLimit(app: FastifyInstance) {
  const check = app.createRateLimit({
    timeWindow: "1 minute",
    max: AUTH_ACCOUNT_RATE_LIMIT_MAX,
    allowList: (request: FastifyRequest) => accountNamed(request) === null,
    keyGenerator: (request: FastifyRequest) => `auth-account:${request.ip}:${accountNamed(request)}`,
  });
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await check(request);
    if (result.isAllowed || !result.isExceeded) return;
    reply.header("retry-after", result.ttlInSeconds);
    return reply.code(429).send({
      error: "Too Many Requests",
      message: "Trop de tentatives pour ce compte : réessayez dans une minute.",
    });
  };
}

/**
 * The event-day screens, per IP and per minute (#642). Their own bucket: the
 * Scan phones, the counter laptops and the help desk all sit behind the
 * venue's single address, and 200 for the lot would run out at the morning
 * peak. Every route behind it requires a session, most the arrivals permission.
 */
export const ARRIVALS_RATE_LIMIT_MAX = 1_000;

export const arrivalsRateLimit = {
  timeWindow: "1 minute",
  max: ARRIVALS_RATE_LIMIT_MAX,
  keyGenerator: (request: FastifyRequest) => `arrivals:${request.ip}`,
};

/** Header the frontend's server-side calls carry (#689). Lower-case: Node's. */
export const INTERNAL_API_HEADER = "x-internal-api-secret";

/**
 * Is this a call from our own frontend's server (SSR), not a visitor (#689)?
 *
 * Those calls come from the frontend container, without a visitor address, so
 * they all fell in one bucket: a spike on uncached pages drained the 200/min
 * budget and the frontend rendered error pages for everyone. They carry the
 * secret from `INTERNAL_API_SECRET` instead, and are exempt from the limit.
 *
 * - Unset or empty secret: no exemption, whatever the header says (today's
 *   behaviour; deploying before the variable exists breaks nothing).
 * - Compared in constant time, on digests so lengths do not leak either.
 * - A call relayed from a browser (Next's `/api/*` rewrite) arrives with the
 *   `X-Forwarded-For` Traefik wrote and passes the visitor's other headers on.
 *   It is never exempt, even with the right secret: that header is the mark of
 *   a visitor, and SSR calls have none. Visitors cannot know the secret anyway;
 *   this keeps a leak of it from opening the API to bursts.
 */
export function isInternalCall(request: FastifyRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const sent = request.headers[INTERNAL_API_HEADER];
  if (typeof sent !== "string" || sent === "") return false;
  if (request.headers["x-forwarded-for"] !== undefined) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(sent), digest(secret));
}

/**
 * Two budgets, two buckets: reading a brochure must not spend what the site's
 * own API calls need, and vice versa. A shared counter with two ceilings would
 * still let the PDF lock the API out for a minute.
 */
export const rateLimitOptions = {
  timeWindow: "1 minute",
  allowList: (request: FastifyRequest) => isInternalCall(request),
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
