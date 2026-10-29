import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
// Tokens are stored hashed, like every link token (#672); the mail carries the token.
import { generateInvitationToken, hashLinkToken, isInvitationExpired } from "../../lib/edit-token.js";
import { MAX_INVITED_PER_BATCH, parseEmailList } from "../../lib/arrivals-access.js";
import { sendArrivalsInvitationEmail } from "../../lib/arrivals-invitation-email.js";

// Who may open an edition's event-day screens (RG-ARR-22, RG-ARR-23, #640),
// managed by an admin: a pasted list of addresses becomes invitations, or
// permissions straight away for those who already have an account.

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

const accessParams = {
  type: "object",
  required: ["editionId", "accessId"],
  properties: {
    editionId: { type: "string", pattern: "^[0-9]+$" },
    accessId: { type: "string", pattern: "^[0-9]+$" },
  },
} as const;

type AccessStatus = "granted" | "pending" | "expired";

function statusOf(row: { userId: string | null; invitationSentAt: Date | null }): AccessStatus {
  if (row.userId) return "granted";
  return isInvitationExpired(row.invitationSentAt) ? "expired" : "pending";
}

async function findEdition(editionId: number) {
  return prisma.edition.findFirst({ where: { id: editionId, ...notDeleted }, select: { id: true, year: true } });
}

export default async function adminArrivalsAccessRoutes(app: FastifyInstance) {
  // GET /api/admin/arrivals-access/:editionId — everyone invited or granted,
  // and where each stands: the admin sees who accepted (RG-ARR-23).
  app.get<{ Params: { editionId: string } }>(
    "/arrivals-access/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      const rows = await prisma.arrivalsAccess.findMany({
        where: { editionId: edition.id },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { email: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.user?.name ?? null,
        role: r.user?.role ?? null,
        status: statusOf(r),
        invitationSentAt: r.invitationSentAt,
        acceptedAt: r.invitationAcceptedAt,
      }));
    },
  );

  // POST /api/admin/arrivals-access/:editionId/invite — the pasted list. Each
  // address is handled on its own: a bad one, or a failed mail, never stops
  // the others, and the report says what happened to every one.
  app.post<{ Params: { editionId: string }; Body: { emails: string } }>(
    "/arrivals-access/:editionId/invite",
    {
      schema: {
        params: editionIdParams,
        body: {
          type: "object",
          required: ["emails"],
          additionalProperties: false,
          properties: { emails: { type: "string", minLength: 1, maxLength: 50_000 } },
        },
      },
    },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");

      const parsed = parseEmailList(request.body.emails);
      if (parsed.emails.length > MAX_INVITED_PER_BATCH) {
        return reply.code(400).send({
          error: "too_many_addresses",
          message: `${parsed.emails.length} adresses : collez-en au plus ${MAX_INVITED_PER_BATCH} à la fois.`,
        });
      }

      const [listed, accounts] = await Promise.all([
        prisma.arrivalsAccess.findMany({
          where: { editionId: edition.id, email: { in: parsed.emails } },
          select: { email: true },
        }),
        // Stored addresses keep their case: compared normalized, here as in
        // the sign-up hook.
        prisma.user.findMany({
          where: { ...notDeleted, OR: parsed.emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
          select: { id: true, email: true },
        }),
      ]);
      const alreadyListed = new Set(listed.map((r) => r.email));
      const accountByEmail = new Map(accounts.map((u) => [u.email.toLowerCase(), u.id]));

      const report = {
        invited: [] as string[],
        granted: [] as string[],
        alreadyListed: [] as string[],
        failed: [] as string[],
        invalid: parsed.invalid,
        duplicates: parsed.duplicates,
      };
      for (const email of parsed.emails) {
        if (alreadyListed.has(email)) {
          report.alreadyListed.push(email);
          continue;
        }
        const userId = accountByEmail.get(email);
        if (userId) {
          // An account exists: the permission is all it needs (RG-ARR-23).
          await prisma.arrivalsAccess.create({ data: { editionId: edition.id, email, userId } });
          report.granted.push(email);
          continue;
        }
        // Send first, persist second (#223): no open sign-up door for a mail
        // that never left.
        const token = generateInvitationToken();
        try {
          await sendArrivalsInvitationEmail({ to: email, editionYear: edition.year, token });
        } catch (err) {
          request.log.error({ err, editionId: edition.id }, "Failed to send arrivals invitation email");
          report.failed.push(email);
          continue;
        }
        await prisma.arrivalsAccess.create({
          data: { editionId: edition.id, email, invitationToken: hashLinkToken(token), invitationSentAt: new Date() },
        });
        report.invited.push(email);
      }
      return reply.code(201).send(report);
    },
  );

  // POST /api/admin/arrivals-access/:editionId/:accessId/resend — a new link for
  // an invitation not accepted yet; the previous one stops working.
  app.post<{ Params: { editionId: string; accessId: string } }>(
    "/arrivals-access/:editionId/:accessId/resend",
    { schema: { params: accessParams } },
    async (request, reply) => {
      const access = await prisma.arrivalsAccess.findFirst({
        where: { id: Number(request.params.accessId), editionId: Number(request.params.editionId) },
        include: { edition: { select: { year: true, deletedAt: true } } },
      });
      if (!access || access.edition.deletedAt) return notFound(reply, "Access");
      if (access.userId) {
        return reply.code(409).send({ error: "already_granted", message: "Cette personne a déjà accès." });
      }
      const token = generateInvitationToken();
      try {
        await sendArrivalsInvitationEmail({ to: access.email, editionYear: access.edition.year, token });
      } catch (err) {
        request.log.error({ err, accessId: access.id }, "Failed to resend arrivals invitation email");
        return reply.code(502).send({ error: "email_failed", message: "L'e-mail n'est pas parti. Réessayez." });
      }
      const updated = await prisma.arrivalsAccess.update({
        where: { id: access.id },
        data: { invitationToken: hashLinkToken(token), invitationSentAt: new Date() },
      });
      return { id: updated.id, status: statusOf(updated), invitationSentAt: updated.invitationSentAt };
    },
  );

  // DELETE /api/admin/arrivals-access/:editionId/:accessId — withdraws the
  // permission, or the invitation. The account stays: it may serve elsewhere.
  app.delete<{ Params: { editionId: string; accessId: string } }>(
    "/arrivals-access/:editionId/:accessId",
    { schema: { params: accessParams } },
    async (request, reply) => {
      const deleted = await prisma.arrivalsAccess.deleteMany({
        where: { id: Number(request.params.accessId), editionId: Number(request.params.editionId) },
      });
      if (deleted.count === 0) return notFound(reply, "Access");
      return reply.code(204).send();
    },
  );
}
