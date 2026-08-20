import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getAuthContext } from "../lib/auth-context.js";
import { findPendingInvitation, normalizeEmail } from "../lib/sponsor-invitation.js";

// Accepting an invitation to a sponsor space (#362).
//
// Unauthenticated on the way in — the token is the credential — but the
// attachment itself requires a signed-in account, because that account is what
// we bind the contact to.

const tokenParamsSchema = {
  type: "object",
  required: ["token"],
  properties: { token: { type: "string" } },
} as const;

export default async function sponsorInvitationRoutes(app: FastifyInstance) {
  // GET /api/sponsor-invitation/:token — what this invitation is for.
  //
  // Lets the page say "you were invited to manage <company>" before asking the
  // visitor to sign in. Returns nothing identifying beyond the company name:
  // whoever holds the token was sent it on purpose.
  app.get<{ Params: { token: string } }>("/sponsor-invitation/:token", {
    schema: { params: tokenParamsSchema },
  }, async (request, reply) => {
    const contact = await findPendingInvitation(request.params.token);
    // One answer for expired, consumed, unknown and trashed alike: telling them
    // apart would let someone probe which tokens ever existed.
    if (!contact) return reply.code(404).send({ error: "invitation_invalid" });

    return {
      sponsorName: contact.sponsor.name,
      accessRole: contact.accessRole,
      // Enough for the page to say which mailbox to use, without printing an
      // address a third party could harvest from a forwarded link.
      emailHint: maskEmail(contact.email),
    };
  });

  // POST /api/sponsor-invitation/:token/accept — bind the signed-in account.
  app.post<{ Params: { token: string } }>("/sponsor-invitation/:token/accept", {
    schema: { params: tokenParamsSchema },
  }, async (request, reply) => {
    const contact = await findPendingInvitation(request.params.token);
    if (!contact) return reply.code(404).send({ error: "invitation_invalid" });

    const ctx = await getAuthContext(request);
    if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });

    // The account's address must be exactly the invited one (#362). Compared on
    // the identity provider's value, the only field a visitor cannot choose —
    // otherwise anyone could bind a personal Google account to the company.
    if (normalizeEmail(ctx.user.email) !== normalizeEmail(contact.email)) {
      return reply.code(403).send({ error: "email_mismatch" });
    }

    // Single-use: clearing the token is what consumes it. Racing calls cannot
    // both win — the second one no longer finds a pending invitation.
    const updated = await prisma.sponsorContact.updateMany({
      where: { id: contact.id, invitationAcceptedAt: null },
      data: { userId: ctx.user.id, invitationToken: null, invitationAcceptedAt: new Date() },
    });
    if (updated.count === 0) return reply.code(404).send({ error: "invitation_invalid" });

    return { sponsorId: contact.sponsorId, sponsorSlug: contact.sponsor.slug, accessRole: contact.accessRole };
  });
}

// "contact@societe.fr" -> "c•••••t@societe.fr". Enough for the invited person
// to recognise their own mailbox, not enough for a stranger to learn it.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  const tail = local.length > 1 ? local.slice(-1) : "";
  return `${head}•••••${tail}@${domain}`;
}
