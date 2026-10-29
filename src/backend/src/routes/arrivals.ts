import type { FastifyInstance } from "fastify";
import { APIError } from "better-auth/api";

import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { getAuthContext } from "../lib/auth-context.js";
import { maskEmail, normalizeEmail, signUpWithInvitation } from "../lib/sponsor-invitation.js";
import { canAccessArrivals, findCurrentEdition, findPendingArrivalsInvitation } from "../lib/arrivals-access.js";
import { subscribeToArrivals, type ArrivalsEvent } from "../lib/arrivals-stream.js";
import { BADGE_STATES, isCounterMove, isStepBack, loadArrivalsSnapshot, moveBadge } from "../lib/badge-state.js";
import { buildOfflineTable, scanTicket, searchAttendees } from "../lib/arrivals-scan.js";
import { requestCheckIn } from "../lib/billetweb-checkin.js";
import { arrivalsRateLimit } from "../lib/rate-limit-options.js";
import type { BadgeState } from "../generated/prisma/client.js";

// The volunteers' side of the arrivals permission (#640): accepting an
// invitation, and knowing whether the signed-in account may open the event-day
// screens. Built like the sponsor invitation (routes/sponsor-invitation.ts),
// whose comments explain each guard. Then the screens' live state (#641): one
// event stream per screen, and the moves of the badges.

/**
 * A ping on an idle stream. Under the relays' idle cut (30 s for Next's
 * rewrite proxy, measured on #639) and frequent enough for a screen to notice
 * a silent break within a few beats (RG-ARR-60).
 */
export const STREAM_HEARTBEAT_MS = 15_000;

/** How long the browser waits before reconnecting after a break. */
const STREAM_RETRY_MS = 2_000;

const tokenParamsSchema = {
  type: "object",
  required: ["token"],
  properties: { token: { type: "string" } },
} as const;

const editionParamsSchema = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "integer", minimum: 1 } },
} as const;

// The event-day screens' own budget (rate-limit-options.ts): the whole venue
// shares one address. The invitation routes keep the general API budget.
const config = { rateLimit: arrivalsRateLimit };

export default async function arrivalsRoutes(app: FastifyInstance) {
  // GET /api/arrivals/current — the edition the screens work on, whether the
  // caller may, and whether they may take a badge back (RG-ARR-46): the
  // screen offers it, the move route decides. 401 tells the page to sign in.
  app.get("/arrivals/current", { config }, async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
    const canStepBack = ctx.user.role === "ADMIN";
    const edition = await findCurrentEdition();
    if (!edition) return { edition: null, hasAccess: false, canStepBack };
    return {
      edition: { id: edition.id, year: edition.year },
      hasAccess: await canAccessArrivals(ctx.user, edition.id),
      canStepBack,
    };
  });

  // GET /api/arrivals/:editionId/stream — Server-Sent Events: the full state
  // first, on every (re)connection (RG-ARR-61), then each badge that moves,
  // and a ping when nothing does.
  app.get<{ Params: { editionId: number } }>(
    "/arrivals/:editionId/stream",
    { config, schema: { params: editionParamsSchema } },
    async (request, reply) => {
      const { editionId } = request.params;
      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      if (!(await canAccessArrivals(ctx.user, editionId))) return reply.code(403).send({ error: "Forbidden" });

      // Subscribe before reading: a move committed while the snapshot loads is
      // queued, not lost. Sent after it, it may repeat what the snapshot
      // already holds; the version on each badge lets the screen skip it.
      const queued: ArrivalsEvent[] = [];
      let isLive = false;
      const send = (event: string, data: unknown) => {
        if (!reply.raw.destroyed) reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const unsubscribe = subscribeToArrivals(editionId, (event) => {
        if (isLive) send(event.type, event.data);
        else queued.push(event);
      });

      const snapshot = await loadArrivalsSnapshot(editionId).catch((err: unknown) => {
        unsubscribe();
        throw err;
      });
      if (!snapshot) {
        unsubscribe();
        return reply.code(404).send({ error: "Not found" });
      }

      // From here the response is ours, outside Fastify's reply cycle: no
      // compression (it would hold events back until a buffer fills), no
      // serializer. `no-transform` and X-Accel-Buffering ask the relays the same.
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write(`retry: ${STREAM_RETRY_MS}\n\n`);
      send("snapshot", snapshot);
      isLive = true;
      for (const event of queued) send(event.type, event.data);

      const heartbeat = setInterval(() => send("ping", { at: Date.now() }), STREAM_HEARTBEAT_MS);
      // The response's close, not the request's: the request one fires once
      // its (empty) body is read, long before the screen goes away.
      reply.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  // POST /api/arrivals/:editionId/badges/:attendeeId/move — a counter touching
  // a card (RG-ARR-43), or an admin taking one back (RG-ARR-46). Answers the
  // badge as it stands, applied or not: a move that lost the race is not an
  // error, the screen just catches up (RG-ARR-44).
  app.post<{ Params: { editionId: number; attendeeId: number }; Body: { from: BadgeState; to: BadgeState } }>(
    "/arrivals/:editionId/badges/:attendeeId/move",
    {
      config,
      schema: {
        params: {
          type: "object",
          required: ["editionId", "attendeeId"],
          properties: {
            editionId: { type: "integer", minimum: 1 },
            attendeeId: { type: "integer", minimum: 1 },
          },
        },
        body: {
          type: "object",
          required: ["from", "to"],
          additionalProperties: false,
          properties: {
            from: { type: "string", enum: [...BADGE_STATES] },
            to: { type: "string", enum: [...BADGE_STATES] },
          },
        },
      },
    },
    async (request, reply) => {
      const { editionId, attendeeId } = request.params;
      const { from, to } = request.body;
      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      if (!(await canAccessArrivals(ctx.user, editionId))) return reply.code(403).send({ error: "Forbidden" });

      const isAllowed = isCounterMove(from, to) || (ctx.user.role === "ADMIN" && isStepBack(from, to));
      if (!isAllowed) {
        return reply.code(400).send({ error: "move_not_allowed", message: "Ce passage n'est pas possible depuis cet écran." });
      }

      const result = await moveBadge(editionId, attendeeId, from, to, {
        id: ctx.user.id,
        label: ctx.user.name || ctx.user.email,
      });
      if (!result) return reply.code(404).send({ error: "Not found" });
      return result;
    },
  );

  // POST /api/arrivals/:editionId/scan — the entrance (#642): a code read by
  // the camera or typed, or an attendee picked from a name search. Answers
  // what to tell the person; the check-in on Billetweb follows on its own.
  app.post<{ Params: { editionId: number }; Body: { code?: string; attendeeId?: number } }>(
    "/arrivals/:editionId/scan",
    {
      config,
      schema: {
        params: editionParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          maxProperties: 1,
          properties: {
            code: { type: "string", minLength: 1, maxLength: 200 },
            attendeeId: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { editionId } = request.params;
      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      if (!(await canAccessArrivals(ctx.user, editionId))) return reply.code(403).send({ error: "Forbidden" });

      const { code, attendeeId } = request.body;
      const target = code !== undefined ? { barcode: code.trim() } : { attendeeId: attendeeId! };
      const { outcome, isFirstScan } = await scanTicket(editionId, target, {
        id: ctx.user.id,
        label: ctx.user.name || ctx.user.email,
      });
      if (isFirstScan) requestCheckIn(editionId, request.log);
      return outcome;
    },
  );

  // GET /api/arrivals/:editionId/search?q= — for whoever comes without their
  // confirmation (RG-ARR-31).
  app.get<{ Params: { editionId: number }; Querystring: { q: string } }>(
    "/arrivals/:editionId/search",
    {
      config,
      schema: {
        params: editionParamsSchema,
        querystring: {
          type: "object",
          required: ["q"],
          properties: { q: { type: "string", minLength: 2, maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const { editionId } = request.params;
      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      if (!(await canAccessArrivals(ctx.user, editionId))) return reply.code(403).send({ error: "Forbidden" });
      return searchAttendees(editionId, request.query.q);
    },
  );

  // GET /api/arrivals/:editionId/offline-table — what a Scan phone keeps for
  // when the backend is gone (RG-ARR-64, RG-ARR-65).
  app.get<{ Params: { editionId: number } }>(
    "/arrivals/:editionId/offline-table",
    { config, schema: { params: editionParamsSchema } },
    async (request, reply) => {
      const { editionId } = request.params;
      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      if (!(await canAccessArrivals(ctx.user, editionId))) return reply.code(403).send({ error: "Forbidden" });
      const table = await buildOfflineTable(editionId);
      if (!table) return reply.code(404).send({ error: "Not found" });
      return table;
    },
  );

  // GET /api/arrivals-invitation/:token — which edition, and which mailbox.
  app.get<{ Params: { token: string } }>(
    "/arrivals-invitation/:token",
    { schema: { params: tokenParamsSchema } },
    async (request, reply) => {
      const access = await findPendingArrivalsInvitation(request.params.token);
      // One answer for expired, consumed and unknown alike.
      if (!access) return reply.code(404).send({ error: "invitation_invalid" });
      return { editionYear: access.edition.year, emailHint: maskEmail(access.email) };
    },
  );

  // POST /api/arrivals-invitation/:token/sign-up — open the invited account,
  // for the invited address only. The sign-up hook makes it GUEST (auth.ts).
  app.post<{ Params: { token: string }; Body: { password: string } }>(
    "/arrivals-invitation/:token/sign-up",
    {
      schema: {
        params: tokenParamsSchema,
        body: {
          type: "object",
          required: ["password"],
          properties: { password: { type: "string", minLength: 1, maxLength: 128 } },
        },
      },
    },
    async (request, reply) => {
      const access = await findPendingArrivalsInvitation(request.params.token);
      if (!access) return reply.code(404).send({ error: "invitation_invalid" });

      try {
        const { headers } = await signUpWithInvitation(access.email, () =>
          auth.api.signUpEmail({
            body: { email: access.email, password: request.body.password, name: access.email },
            returnHeaders: true,
          }),
        );
        const cookies = headers.getSetCookie();
        if (cookies.length) reply.header("set-cookie", cookies);
        return { success: true };
      } catch (err) {
        if (err instanceof APIError) {
          return reply.code(err.statusCode).send({ error: err.body?.code ?? "sign_up_failed", message: err.body?.message });
        }
        throw err;
      }
    },
  );

  // POST /api/arrivals-invitation/:token/accept — grant the signed-in account.
  app.post<{ Params: { token: string } }>(
    "/arrivals-invitation/:token/accept",
    { schema: { params: tokenParamsSchema } },
    async (request, reply) => {
      const access = await findPendingArrivalsInvitation(request.params.token);
      if (!access) return reply.code(404).send({ error: "invitation_invalid" });

      const ctx = await getAuthContext(request);
      if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
      // Only the invited mailbox: a forwarded link must not grant a stranger.
      if (normalizeEmail(ctx.user.email) !== access.email) {
        return reply.code(403).send({ error: "email_mismatch" });
      }

      // Clearing the token consumes it: a racing second call finds nothing.
      const updated = await prisma.arrivalsAccess.updateMany({
        where: { id: access.id, userId: null, invitationAcceptedAt: null },
        data: { userId: ctx.user.id, invitationToken: null, invitationAcceptedAt: new Date() },
      });
      if (updated.count === 0) return reply.code(404).send({ error: "invitation_invalid" });

      // The token reached this mailbox: without this, the first magic link
      // would clear the password of an unverified account (RG-ARR-24, #514).
      await prisma.user.update({ where: { id: ctx.user.id }, data: { emailVerified: true } });
      return { editionYear: access.edition.year };
    },
  );
}
