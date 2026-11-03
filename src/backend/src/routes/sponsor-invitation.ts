import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { APIError } from "better-auth/api";

import { auth } from "../lib/auth.js";
import { getAuthContext } from "../lib/auth-context.js";
import { findPendingInvitation, normalizeEmail, signUpWithInvitation } from "../lib/sponsor-invitation.js";

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

  // POST /api/sponsor-invitation/:token/sign-up — open the invited account.
  //
  // The only way to create a sponsor account with a password (#658): the token
  // proves the mailbox, so the address is the invitation's, never the body's,
  // and the account starts verified. Answers with better-auth's own session
  // cookie; binding the account to the company stays /accept's job.
  //
  // better-auth's sign-up neither signs in nor reports an existing account any
  // more (#673): this route says so itself — the token holder owns the
  // mailbox, there is nothing to hide from them — and signs in afterwards.
  app.post<{ Params: { token: string }; Body: { password: string } }>("/sponsor-invitation/:token/sign-up", {
    schema: {
      params: tokenParamsSchema,
      body: {
        type: "object",
        required: ["password"],
        properties: { password: { type: "string", minLength: 1, maxLength: 128 } },
      },
    },
  }, async (request, reply) => {
    const contact = await findPendingInvitation(request.params.token);
    if (!contact) return reply.code(404).send({ error: "invitation_invalid" });

    const existing = await prisma.user.findFirst({
      where: { email: { equals: contact.email.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({
        error: "account_exists",
        message: "Un compte existe déjà pour cette adresse : connectez-vous, ou demandez un lien de connexion.",
      });
    }

    try {
      const { email } = contact;
      const { password } = request.body;
      await signUpWithInvitation(email, () =>
        auth.api.signUpEmail({ body: { email, password, name: contact.name || email } }),
      );
      const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const cookies = headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return { success: true };
    } catch (err) {
      if (err instanceof APIError) {
        return reply.code(err.statusCode).send({ error: err.body?.code ?? "sign_up_failed", message: err.body?.message });
      }
      throw err;
    }
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

    // The token was mailed to this exact address: the mailbox is proven. Left
    // unverified, a password account would lose its password on its first
    // magic-link sign-in — better-auth 1.7 treats an unverified account's
    // credentials as unproven and clears them (#514).
    await prisma.user.update({ where: { id: ctx.user.id }, data: { emailVerified: true } });

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
