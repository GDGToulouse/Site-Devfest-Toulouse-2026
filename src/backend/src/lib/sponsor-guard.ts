import type { FastifyRequest, FastifyReply } from "fastify";

import { prisma } from "./prisma.js";
import { getAuthContext } from "./auth-context.js";

// Authorization for a sponsor's own space (#362).
//
// A second, independent path from requireAnyAuthenticated: that one guards the
// back-office on UserRole and stays untouched. Widening it would have handed
// /api/admin/* to every sponsor. Here the right comes from the SponsorContact
// binding this account to this company — nothing else.

export type SponsorAccessRole = "RESPONSABLE" | "EDITEUR" | "STAND";

// Higher grants everything a lower one does. Compared by rank so a route asks
// for a minimum ("at least EDITEUR") rather than enumerating roles.
const RANK: Record<SponsorAccessRole, number> = {
  STAND: 1,
  EDITEUR: 2,
  RESPONSABLE: 3,
};

export interface SponsorAccess {
  sponsorId: number;
  contactId: number;
  accessRole: SponsorAccessRole;
  // True when an ADMIN is looking at the space for support rather than acting
  // as a member of the company. Handlers that log who changed what should say
  // so rather than attribute the change to the sponsor.
  isAdminOverride: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    sponsorAccess?: SponsorAccess;
  }
}

export function hasAtLeast(role: SponsorAccessRole, minimum: SponsorAccessRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * preHandler factory: requires an account allowed to act on the sponsor named
 * by `:sponsorId` (or `:id`) in the route params, at `minimum` or above.
 *
 * Answers 404 rather than 403 when the account holds no contact for that
 * sponsor: a stranger probing ids must not learn which ones exist.
 */
export function requireSponsorAccess(minimum: SponsorAccessRole) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { sponsorId?: string; id?: string };
    const sponsorId = Number(params.sponsorId ?? params.id);
    if (!Number.isInteger(sponsorId)) {
      reply.status(400).send({ error: "Invalid sponsor id" });
      return;
    }

    const ctx = await getAuthContext(request);
    if (!ctx) {
      reply.status(401).send({ error: "Unauthenticated" });
      return;
    }

    // Support access, granted explicitly rather than by giving admins a
    // SponsorContact — which would put them in the company's own team list.
    if (ctx.user.role === "ADMIN") {
      const sponsor = await prisma.sponsor.findFirst({
        where: { id: sponsorId, deletedAt: null },
        select: { id: true },
      });
      if (!sponsor) {
        reply.status(404).send({ error: "Sponsor not found" });
        return;
      }
      request.sponsorAccess = {
        sponsorId,
        contactId: -1,
        accessRole: "RESPONSABLE",
        isAdminOverride: true,
      };
      return;
    }

    const contact = await prisma.sponsorContact.findFirst({
      where: {
        sponsorId,
        userId: ctx.user.id,
        // A trashed company grants nothing while it sits in the bin (#146).
        sponsor: { deletedAt: null },
      },
      select: { id: true, accessRole: true },
    });
    if (!contact) {
      reply.status(404).send({ error: "Sponsor not found" });
      return;
    }

    if (!hasAtLeast(contact.accessRole, minimum)) {
      reply.status(403).send({ error: "Forbidden" });
      return;
    }

    request.sponsorAccess = {
      sponsorId,
      contactId: contact.id,
      accessRole: contact.accessRole,
      isAdminOverride: false,
    };
  };
}
