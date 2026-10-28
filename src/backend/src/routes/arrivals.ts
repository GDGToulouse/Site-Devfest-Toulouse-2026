import type { FastifyInstance } from "fastify";
import { APIError } from "better-auth/api";

import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { getAuthContext } from "../lib/auth-context.js";
import { maskEmail, normalizeEmail, signUpWithInvitation } from "../lib/sponsor-invitation.js";
import { canAccessArrivals, findCurrentEdition, findPendingArrivalsInvitation } from "../lib/arrivals-access.js";

// The volunteers' side of the arrivals permission (#640): accepting an
// invitation, and knowing whether the signed-in account may open the event-day
// screens. Built like the sponsor invitation (routes/sponsor-invitation.ts),
// whose comments explain each guard.

const tokenParamsSchema = {
  type: "object",
  required: ["token"],
  properties: { token: { type: "string" } },
} as const;

export default async function arrivalsRoutes(app: FastifyInstance) {
  // GET /api/arrivals/current — the edition the screens work on, and whether
  // the caller may. 401 tells the page to sign in first.
  app.get("/arrivals/current", async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });
    const edition = await findCurrentEdition();
    if (!edition) return { edition: null, hasAccess: false };
    return {
      edition: { id: edition.id, year: edition.year },
      hasAccess: await canAccessArrivals(ctx.user, edition.id),
    };
  });

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
