import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getAuthContext } from "../lib/auth-context.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { requireSponsorAccess } from "../lib/sponsor-guard.js";

// A sponsor's own space (#362) — what a company sees about itself once it has
// an account, as opposed to /api/admin/* (organisers) and /api/edit/:token
// (editing without an account, still in service for speakers).

const sponsorIdParams = {
  type: "object",
  required: ["sponsorId"],
  properties: { sponsorId: { type: "string" } },
} as const;

export default async function sponsorSpaceRoutes(app: FastifyInstance) {
  // GET /api/sponsor-space/mine — the companies this account may act on.
  //
  // The entry point: a person invited by two companies has to pick one, and the
  // frontend cannot guess the ids on its own.
  app.get("/sponsor-space/mine", async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });

    const contacts = await prisma.sponsorContact.findMany({
      where: { userId: ctx.user.id, sponsor: notDeleted },
      select: {
        accessRole: true,
        sponsor: { select: { id: true, slug: true, name: true, logoUrl: true } },
      },
      orderBy: { sponsor: { name: "asc" } },
    });

    return contacts.map((c) => ({ ...c.sponsor, accessRole: c.accessRole }));
  });

  // GET /api/sponsor-space/:sponsorId — the company's own profile.
  //
  // STAND may read it: the booth team needs to know what the page says, which
  // is public anyway. Private fields are NOT here — see /private below.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
  }, async (request, reply) => {
    const sponsorId = request.sponsorAccess!.sponsorId;
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, ...notDeleted },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        websiteUrl: true,
        descriptionFr: true,
        descriptionEn: true,
        socialLinks: true,
        editions: {
          where: { edition: notDeleted },
          select: {
            editionId: true,
            edition: { select: { year: true } },
            publicationStatus: true,
            tier: { select: { key: true, nameFr: true, nameEn: true } },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    return {
      ...sponsor,
      socialLinks: sponsor.socialLinks ? JSON.parse(sponsor.socialLinks) : {},
      accessRole: request.sponsorAccess!.accessRole,
    };
  });

  // GET /api/sponsor-space/:sponsorId/private — the com kit and booth notes.
  //
  // EDITEUR and above only: STAND is read-only on the public profile and has no
  // business seeing what the organisers and the company exchange privately.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/private", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const sponsorId = request.sponsorAccess!.sponsorId;
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, ...notDeleted },
      select: {
        standContacts: true,
        editions: {
          where: { edition: notDeleted },
          select: {
            editionId: true,
            edition: { select: { year: true } },
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            tier: { select: { allowsPromoIdeas: true } },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    return {
      standContacts: sponsor.standContacts ? JSON.parse(sponsor.standContacts) : [],
      editions: sponsor.editions,
    };
  });

  // GET /api/sponsor-space/:sponsorId/team — who has access, and as what.
  //
  // RESPONSABLE only: the team list carries the colleagues' addresses, which an
  // EDITEUR has no reason to enumerate.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/team", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("RESPONSABLE"),
  }, async (request) => {
    const contacts = await prisma.sponsorContact.findMany({
      where: { sponsorId: request.sponsorAccess!.sponsorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessRole: true,
        userId: true,
        invitationSentAt: true,
        invitationAcceptedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Tokens never leave the server — only whether an invitation is pending.
    return contacts.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      role: c.role,
      accessRole: c.accessRole,
      hasAccount: !!c.userId,
      invitationSentAt: c.invitationSentAt,
      invitationAcceptedAt: c.invitationAcceptedAt,
    }));
  });
}
