import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateJobOffers, revalidateSponsor, revalidateSponsors } from "../../lib/revalidate.js";
import { slugify } from "../../lib/slug.js";
import { generateEditToken, generateInvitationToken, isInvitationExpired } from "../../lib/edit-token.js";
import { resolveInitialAccessRole } from "../../lib/sponsor-invitation.js";
import { sendEditLinkEmail, sendSponsorInvitationEmail, normalizeLocale } from "../../lib/edit-link-email.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

// Identity — shared across every edition the company sponsors.
interface SponsorIdentityFields {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
  locale?: string;
  // Private fields (#249) — organizers only.
  standContacts?: StandContact[];
}

// Participation — bought or tracked for one edition (#129).
interface SponsorParticipationFields {
  tierId: number;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  // Private fields (#249) — organizers only.
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string;
  comKitLogoPrintUrl?: string;
  comKitCharterUrl?: string;
  comKitNotes?: string;
  platinumPromoIdea?: string;
  platinumCoBuildIdea?: string;
}

interface SponsorCreateBody extends SponsorIdentityFields, SponsorParticipationFields {
  editionId: number;
}

// `editionId` says which participation the per-year fields target (defaults to
// the most recent one when omitted).
type SponsorUpdateBody = Partial<Omit<SponsorCreateBody, "editionId">> & { editionId?: number };

interface SponsorIdParams {
  id: string;
}

interface SponsorListQuery {
  editionId?: string;
}

interface SponsorBulkBody {
  ids: number[];
  action: "setStatus";
  value: "DRAFT" | "PUBLISHED";
  editionId: number;
}

const TIER_SELECT = { id: true, key: true, nameFr: true, nameEn: true, rank: true } as const;

// Access roles on a sponsor's space (#362). Listed here rather than imported
// from the generated client so the request body is validated against a plain
// allow-list — an unknown value must be a 422, not a Prisma error.
type SponsorAccessRole = "RESPONSABLE" | "EDITEUR" | "STAND";
const ACCESS_ROLES: SponsorAccessRole[] = ["RESPONSABLE", "EDITEUR", "STAND"];

interface ParticipationLike {
  id: number;
  publicationStatus: "DRAFT" | "PUBLISHED";
  // Frozen per edition (#375) — absent from the queries that don't select it.
  logoUrl?: string | null;
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string | null;
  comKitLogoPrintUrl?: string | null;
  comKitCharterUrl?: string | null;
  comKitNotes?: string | null;
  platinumPromoIdea?: string | null;
  platinumCoBuildIdea?: string | null;
  editionId: number;
  edition: { id: number; year: number };
  tier: { id: number; key: string; nameFr: string; nameEn: string; rank: number };
  jobOffers?: unknown[];
}

// Flatten identity + the participation the admin is looking at (the most
// recent one, unless the list/detail query narrowed to a single edition) into
// the shape the admin frontend already expects: flat `tier`, `tierId`,
// `publicationStatus`, `edition`, `editionId`.
function serialize(s: {
  socialLinks: string | null;
  standContacts?: string | null;
  editions?: ParticipationLike[];
  [k: string]: unknown;
}) {
  const { editions, ...rest } = s;
  const current = editions?.[0];
  return {
    ...rest,
    socialLinks: s.socialLinks ? JSON.parse(s.socialLinks) : {},
    standContacts: s.standContacts ? JSON.parse(s.standContacts) : [],
    ...(current && {
      participationId: current.id,
      editionId: current.editionId,
      edition: current.edition,
      tierId: current.tier.id,
      tier: current.tier,
      // The edition's own logo (#375) shadows the identity's, so the admin
      // form edits the year it is looking at. Null until one is set.
      ...(current.logoUrl !== undefined && { logoUrl: current.logoUrl ?? s.logoUrl }),
      publicationStatus: current.publicationStatus,
      comKitReceived: current.comKitReceived,
      comKitLogoWebUrl: current.comKitLogoWebUrl,
      comKitLogoPrintUrl: current.comKitLogoPrintUrl,
      comKitCharterUrl: current.comKitCharterUrl,
      comKitNotes: current.comKitNotes,
      platinumPromoIdea: current.platinumPromoIdea,
      platinumCoBuildIdea: current.platinumCoBuildIdea,
      ...(current.jobOffers && { jobOffers: current.jobOffers }),
    }),
    editions: editions?.map((e) => ({
      editionId: e.editionId,
      edition: e.edition,
      tier: e.tier,
      publicationStatus: e.publicationStatus,
    })),
  };
}

export default async function adminSponsorRoutes(app: FastifyInstance) {
  // GET /api/admin/sponsors?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: SponsorListQuery }>("/sponsors", {
    schema: {
      querystring: { type: "object", properties: { editionId: { type: "string" } } },
    },
  }, async (request) => {
    const editionId = request.query.editionId ? Number(request.query.editionId) : undefined;

    // One row per company (#129): the list moves onto the join, mirroring the
    // admin speakers list. `editions` carries every participation so the row
    // can flatten to the one the admin is looking at.
    const sponsors = await prisma.sponsor.findMany({
      where: {
        ...notDeleted,
        ...(editionId ? { editions: { some: { editionId } } } : {}),
      },
      include: {
        editions: {
          where: { ...(editionId ? { editionId } : {}), edition: notDeleted },
          select: {
            id: true,
            publicationStatus: true,
            logoUrl: true,
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            editionId: true,
            edition: { select: { id: true, year: true } },
            tier: { select: TIER_SELECT },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
      orderBy: { name: "asc" },
    });
    return sponsors.map(serialize);
  });

  // GET /api/admin/sponsors/:id
  app.get<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: {
        editions: {
          where: { edition: notDeleted },
          select: {
            id: true,
            publicationStatus: true,
            logoUrl: true,
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            editionId: true,
            edition: { select: { id: true, year: true } },
            tier: { select: TIER_SELECT },
            // Job offers for admin consultation/moderation (#251), now per
            // participation since they are dated by the year's tier quota.
            jobOffers: { orderBy: { createdAt: "asc" } },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });
    return serialize(sponsor);
  });

  // POST /api/admin/sponsors
  app.post<{ Body: SponsorCreateBody }>("/sponsors", async (request, reply) => {
    const body = request.body;

    if (!body.editionId || !body.name?.trim() || !body.tierId) {
      return reply.code(400).send({ error: "editionId, name and tierId are required" });
    }
    // The display attributes come along: the participation freezes them (#375)
    // so renaming or recolouring the shared catalogue later leaves this
    // edition's wall untouched.
    const tier = await prisma.sponsorTier.findFirst({
      where: { id: body.tierId, ...notDeleted },
      select: { id: true, nameFr: true, nameEn: true, color: true, logoScale: true },
    });
    if (!tier) {
      return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });
    }

    const slug = slugify(body.name);

    // Globally unique since #129. A taken slug means the company already
    // exists: offer to attach a participation rather than minting acme-2 and
    // recreating the duplicates the model was changed to remove. Deliberately
    // NOT filtered on deletedAt — a trashed company still owns its slug until
    // purged.
    const clash = await prisma.sponsor.findUnique({ where: { slug }, select: { id: true } });
    if (clash) {
      return reply.code(409).send({ error: "sponsor_exists", id: clash.id });
    }

    const sponsor = await prisma.sponsor.create({
      include: {
        editions: {
          select: {
            id: true,
            publicationStatus: true,
            logoUrl: true,
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            editionId: true,
            edition: { select: { id: true, year: true } },
            tier: { select: TIER_SELECT },
          },
        },
      },
      data: {
        slug,
        name: body.name.trim(),
        logoUrl: body.logoUrl || null,
        websiteUrl: body.websiteUrl || null,
        // Rich-text HTML (#270): sanitized on write, like article content.
        descriptionFr: sanitizeRichHtml(body.descriptionFr) || null,
        descriptionEn: sanitizeRichHtml(body.descriptionEn) || null,
        socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        contactEmail: body.contactEmail || null,
        locale: normalizeLocale(body.locale),
        // Private fields (#249).
        standContacts: body.standContacts?.length ? JSON.stringify(body.standContacts) : null,
        editions: {
          create: [{
            editionId: body.editionId,
            tierId: body.tierId,
            // Frozen for the archive (#375): the logo this edition shows, and
            // the tier as it reads today.
            logoUrl: body.logoUrl || null,
            tierNameFr: tier.nameFr,
            tierNameEn: tier.nameEn,
            tierColor: tier.color,
            tierLogoScale: tier.logoScale,
            publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
            comKitReceived: body.comKitReceived ?? false,
            comKitLogoWebUrl: body.comKitLogoWebUrl || null,
            comKitLogoPrintUrl: body.comKitLogoPrintUrl || null,
            comKitCharterUrl: body.comKitCharterUrl || null,
            comKitNotes: body.comKitNotes || null,
            platinumPromoIdea: body.platinumPromoIdea || null,
            platinumCoBuildIdea: body.platinumCoBuildIdea || null,
          }],
        },
      },
    });

    revalidateSponsors();
    revalidateSponsor(sponsor.slug);
    return reply.code(201).send(serialize(sponsor));
  });

  // PUT /api/admin/sponsors/:id
  app.put<{ Params: SponsorIdParams; Body: SponsorUpdateBody }>("/sponsors/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const body = request.body;

    // Changing tier re-freezes the appearance (#375): the participation must
    // show the tier it was actually moved to, not the one it left.
    let tier = null;
    if (body.tierId !== undefined) {
      tier = await prisma.sponsorTier.findFirst({
        where: { id: body.tierId, ...notDeleted },
        select: { id: true, nameFr: true, nameEn: true, color: true, logoScale: true },
      });
      if (!tier) {
        return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });
      }
    }

    // Per-year fields need a participation to land on. Resolve it from
    // `body.editionId`, falling back to the most recent one.
    const participationFieldsSent =
      body.tierId !== undefined ||
      body.logoUrl !== undefined ||
      body.publicationStatus !== undefined ||
      body.comKitReceived !== undefined ||
      body.comKitLogoWebUrl !== undefined ||
      body.comKitLogoPrintUrl !== undefined ||
      body.comKitCharterUrl !== undefined ||
      body.comKitNotes !== undefined ||
      body.platinumPromoIdea !== undefined ||
      body.platinumCoBuildIdea !== undefined;

    const target = participationFieldsSent
      ? body.editionId
        ? await prisma.editionSponsor.findUnique({
            where: { sponsorId_editionId: { sponsorId: id, editionId: body.editionId } },
            select: { id: true },
          })
        : await prisma.editionSponsor.findFirst({
            where: { sponsorId: id },
            orderBy: { edition: { year: "desc" } },
            select: { id: true },
          })
      : null;

    if (participationFieldsSent && !target) {
      return reply.code(422).send({ error: "No participation found to update" });
    }

    if (target) {
      await prisma.editionSponsor.update({
        where: { id: target.id },
        data: {
          // Re-freeze the appearance alongside the tier itself (#375).
          ...(tier && {
            tierId: tier.id,
            tierNameFr: tier.nameFr,
            tierNameEn: tier.nameEn,
            tierColor: tier.color,
            tierLogoScale: tier.logoScale,
          }),
          // The logo this edition displays, kept off the other years.
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
          ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
          ...(body.comKitReceived !== undefined && { comKitReceived: body.comKitReceived }),
          ...(body.comKitLogoWebUrl !== undefined && { comKitLogoWebUrl: body.comKitLogoWebUrl || null }),
          ...(body.comKitLogoPrintUrl !== undefined && { comKitLogoPrintUrl: body.comKitLogoPrintUrl || null }),
          ...(body.comKitCharterUrl !== undefined && { comKitCharterUrl: body.comKitCharterUrl || null }),
          ...(body.comKitNotes !== undefined && { comKitNotes: body.comKitNotes || null }),
          ...(body.platinumPromoIdea !== undefined && { platinumPromoIdea: body.platinumPromoIdea || null }),
          ...(body.platinumCoBuildIdea !== undefined && { platinumCoBuildIdea: body.platinumCoBuildIdea || null }),
        },
      });
    }

    const sponsor = await prisma.sponsor.update({
      where: { id },
      include: {
        editions: {
          where: target ? { id: target.id } : {},
          select: {
            id: true,
            publicationStatus: true,
            logoUrl: true,
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            editionId: true,
            edition: { select: { id: true, year: true } },
            tier: { select: TIER_SELECT },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
        // Rich-text HTML (#270): sanitized on write, like article content.
        ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) || null }),
        ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) || null }),
        ...(body.socialLinks !== undefined && {
          socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail || null }),
        ...(body.locale !== undefined && { locale: normalizeLocale(body.locale) }),
        // Private fields (#249).
        ...(body.standContacts !== undefined && {
          standContacts: body.standContacts?.length ? JSON.stringify(body.standContacts) : null,
        }),
      },
    });

    revalidateSponsors();
    // No second slug to purge here, unlike speakers (#351): a sponsor's slug is
    // computed once at creation and never recomputed on update.
    revalidateSponsor(sponsor.slug);
    return serialize(sponsor);
  });

  // POST /api/admin/sponsors/bulk — apply one action to several sponsors at once.
  app.post<{ Body: SponsorBulkBody }>("/sponsors/bulk", async (request, reply) => {
    const { ids, action, value, editionId } = request.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return reply.code(400).send({ error: "ids must be a non-empty array of integers" });
    }
    if (action !== "setStatus" || (value !== "DRAFT" && value !== "PUBLISHED")) {
      return reply.code(400).send({ error: "unsupported action or value" });
    }
    // publicationStatus now lives on the participation (#129): require the
    // edition so the action cannot silently touch a year the admin isn't
    // looking at (the guard #351 established for speakers).
    if (!editionId) {
      return reply.code(400).send({ error: "editionId is required: status is per edition" });
    }

    const { count } = await prisma.editionSponsor.updateMany({
      where: { sponsorId: { in: ids }, editionId, sponsor: notDeleted },
      data: { publicationStatus: value },
    });
    revalidateSponsors();
    return { count };
  });

  // DELETE /api/admin/sponsors/:id — moves the sponsor to the trash (#147). The
  // row survives with `deletedAt` set; #145c restores it, #145d purges it.
  app.delete<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
  }, async (request, reply) => {
    const sponsorId = Number(request.params.id);
    const sponsor = await prisma.sponsor.findFirst({ where: { id: sponsorId, ...notDeleted } });
    if (!sponsor) return notFound(reply, "Sponsor");

    // The slug is globally unique (#129) and a trashed row keeps its slot, so
    // park it out of the live namespace — otherwise re-creating a sponsor
    // under the same name would hit the constraint (#146).
    await prisma.sponsor.update({
      where: { id: sponsorId },
      data: { ...softDeleteData(), slug: parkUniqueValue(sponsor.slug, sponsorId) },
    });
    revalidateSponsors();
    // The slug it had while public — the parked one was never served, and its
    // page has to stop answering from cache now that the row is trashed.
    revalidateSponsor(sponsor.slug);
    return reply.code(204).send();
  });

  // POST /api/admin/sponsors/:id/editions — attach a participation (#129).
  app.post<{ Params: SponsorIdParams; Body: { editionId: number; tierId: number } }>(
    "/sponsors/:id/editions",
    { schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
    async (request, reply) => {
      const sponsorId = Number(request.params.id);
      const { editionId, tierId } = request.body;
      if (!editionId || !tierId) {
        return reply.code(400).send({ error: "editionId and tierId are required" });
      }
      // Same freeze as on create (#375): a participation attached here must
      // carry the tier's appearance too, or renaming the shared catalogue
      // later would repaint this edition. The logo comes from the identity,
      // which is all this company has at this point.
      const sponsor = await prisma.sponsor.findFirst({
        where: { id: sponsorId, ...notDeleted },
        select: { logoUrl: true },
      });
      if (!sponsor) return notFound(reply, "Sponsor");

      const tier = await prisma.sponsorTier.findFirst({
        where: { id: tierId, ...notDeleted },
        select: { id: true, nameFr: true, nameEn: true, color: true, logoScale: true },
      });
      if (!tier) return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });

      const frozen = {
        tierId: tier.id,
        tierNameFr: tier.nameFr,
        tierNameEn: tier.nameEn,
        tierColor: tier.color,
        tierLogoScale: tier.logoScale,
      };
      const participation = await prisma.editionSponsor.upsert({
        where: { sponsorId_editionId: { sponsorId, editionId } },
        create: { sponsorId, editionId, ...frozen, logoUrl: sponsor.logoUrl, publicationStatus: "DRAFT" },
        update: frozen,
        select: { id: true, editionId: true, tierId: true, publicationStatus: true },
      });
      revalidateSponsors();
      return participation;
    },
  );

  // DELETE /api/admin/sponsors/:id/editions/:editionId — detach a participation.
  // The company itself survives: the trash operates on the identity.
  app.delete<{ Params: SponsorIdParams & { editionId: string } }>(
    "/sponsors/:id/editions/:editionId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "editionId"],
          properties: { id: { type: "string" }, editionId: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { count } = await prisma.editionSponsor.deleteMany({
        where: { sponsorId: Number(request.params.id), editionId: Number(request.params.editionId) },
      });
      if (!count) return notFound(reply, "Participation not found");
      revalidateSponsors();
      return reply.code(204).send();
    },
  );

  // A sponsor can have several contacts, each with its own modification link
  // (#250). The token itself is never returned to the admin — only whether a
  // link is active, when it was sent, and if it's locked.
  const serializeContact = (c: {
    id: number;
    email: string;
    name: string | null;
    role: string | null;
    editToken: string | null;
    editLinkLocked: boolean;
    editTokenSentAt: Date | null;
    accessRole?: SponsorAccessRole;
    userId?: string | null;
    invitationToken?: string | null;
    invitationSentAt?: Date | null;
    invitationAcceptedAt?: Date | null;
  }) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    role: c.role,
    hasLink: !!c.editToken,
    editLinkLocked: c.editLinkLocked,
    editTokenSentAt: c.editTokenSentAt,
    // Account access (#362). Like the edit token above, the invitation token
    // itself is never returned — only whether one is outstanding.
    accessRole: c.accessRole,
    hasAccount: !!c.userId,
    // The 7-day TTL is a server rule: reported here rather than recomputed from
    // invitationSentAt by the client, which would let the two drift apart. An
    // expired invitation is neither pending nor absent — the admin has to know
    // it needs sending again.
    invitationPending:
      !!c.invitationToken && !c.invitationAcceptedAt && !isInvitationExpired(c.invitationSentAt ?? null),
    invitationExpired:
      !!c.invitationToken && !c.invitationAcceptedAt && isInvitationExpired(c.invitationSentAt ?? null),
    invitationSentAt: c.invitationSentAt,
    invitationAcceptedAt: c.invitationAcceptedAt,
  });

  // GET /api/admin/sponsors/:id/contacts — list a sponsor's contacts.
  app.get<{ Params: SponsorIdParams }>("/sponsors/:id/contacts", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const contacts = await prisma.sponsorContact.findMany({
      where: { sponsorId: Number(request.params.id) },
      orderBy: { createdAt: "asc" },
    });
    return contacts.map(serializeContact);
  });

  // POST /api/admin/sponsors/:id/contacts — add a contact and send its link.
  app.post<{ Params: SponsorIdParams; Body: { email?: string; name?: string; role?: string } }>(
    "/sponsors/:id/contacts",
    { schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
    async (request, reply) => {
      const sponsorId = Number(request.params.id);
      // findFirst, not findUnique: a trashed sponsor must not gain new contacts.
      const sponsor = await prisma.sponsor.findFirst({ where: { id: sponsorId, ...notDeleted } });
      if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

      const email = request.body.email?.trim();
      if (!email) return reply.code(400).send({ error: "No contact email provided" });

      // Send first, persist second (#223): if the mail fails we create nothing.
      const token = generateEditToken();
      try {
        await sendEditLinkEmail({ to: email, name: sponsor.name, token, kind: "sponsor", locale: sponsor.locale });
      } catch (err) {
        request.log.error({ err }, "Failed to send sponsor edit link email");
        return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
      }

      const contact = await prisma.sponsorContact.create({
        data: {
          sponsorId,
          email,
          name: request.body.name?.trim() || null,
          role: request.body.role?.trim() || null,
          editToken: token,
          editTokenSentAt: new Date(),
        },
      });
      return reply.code(201).send(serializeContact(contact));
    },
  );

  // POST /api/admin/sponsors/:id/contacts/:contactId/resend — rotate + resend.
  app.post<{ Params: SponsorIdParams & { contactId: string } }>(
    "/sponsors/:id/contacts/:contactId/resend",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
        include: { sponsor: true },
      });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }

      const token = generateEditToken();
      try {
        await sendEditLinkEmail({ to: contact.email, name: contact.sponsor.name, token, kind: "sponsor", locale: contact.sponsor.locale });
      } catch (err) {
        request.log.error({ err }, "Failed to resend sponsor edit link email");
        return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
      }

      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date() },
      });
      return serializeContact(updated);
    },
  );

  // POST /api/admin/sponsors/:id/contacts/:contactId/invite — invite this
  // contact to create an account on the sponsor's space (#362).
  //
  // Distinct from /resend, which hands out an edit link that works on its own:
  // this opens an account. Re-inviting rotates the token, so the previous
  // invitation stops working — the column is @unique, but the behaviour is
  // deliberate, not a side effect.
  app.post<{ Params: SponsorIdParams & { contactId: string }; Body: { accessRole?: SponsorAccessRole } }>(
    "/sponsors/:id/contacts/:contactId/invite",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
        include: { sponsor: true },
      });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return notFound(reply, "Contact");
      }
      if (contact.sponsor.deletedAt) return notFound(reply, "Sponsor");
      if (contact.userId) {
        return reply.code(409).send({ error: "already_has_account" });
      }

      const accessRole = request.body?.accessRole;
      if (accessRole && !ACCESS_ROLES.includes(accessRole)) {
        return reply.code(422).send({ error: "Invalid accessRole" });
      }

      // Send first, persist second (#223): a failed mail must leave no
      // invitation behind, or the sign-up door opens for nobody's benefit.
      const token = generateInvitationToken();
      try {
        await sendSponsorInvitationEmail({
          to: contact.email,
          sponsorName: contact.sponsor.name,
          token,
          locale: contact.sponsor.locale,
        });
      } catch (err) {
        request.log.error({ err }, "Failed to send sponsor invitation email");
        return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
      }

      // The first invited contact is promoted to RESPONSABLE whatever was asked,
      // so the company can invite its own team (#362).
      const promoted = await resolveInitialAccessRole(contact.sponsorId, contact.id);
      const role = promoted ?? accessRole;

      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: {
          invitationToken: token,
          invitationSentAt: new Date(),
          invitationAcceptedAt: null,
          ...(role ? { accessRole: role } : {}),
        },
      });
      return serializeContact(updated);
    },
  );

  // PUT /api/admin/sponsors/:id/contacts/:contactId/access-role — change what
  // this person may do on the sponsor's space (#362).
  app.put<{ Params: SponsorIdParams & { contactId: string }; Body: { accessRole: SponsorAccessRole } }>(
    "/sponsors/:id/contacts/:contactId/access-role",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const sponsorId = Number(request.params.id);
      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
      });
      if (!contact || contact.sponsorId !== sponsorId) return notFound(reply, "Contact");

      const { accessRole } = request.body ?? {};
      if (!accessRole || !ACCESS_ROLES.includes(accessRole)) {
        return reply.code(422).send({ error: "Invalid accessRole" });
      }

      // Demoting the last RESPONSABLE would leave the space with nobody able to
      // invite: the company could no longer manage its own team, and only an
      // admin could unblock it.
      if (contact.accessRole === "RESPONSABLE" && accessRole !== "RESPONSABLE") {
        const others = await prisma.sponsorContact.count({
          where: { sponsorId, accessRole: "RESPONSABLE", id: { not: contact.id } },
        });
        if (others === 0) return reply.code(409).send({ error: "last_responsable" });
      }

      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { accessRole },
      });
      return serializeContact(updated);
    },
  );

  // PUT /api/admin/sponsors/:id/contacts/:contactId/lock — lock/unlock a link.
  app.put<{ Params: SponsorIdParams & { contactId: string }; Body: { locked: boolean } }>(
    "/sponsors/:id/contacts/:contactId/lock",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({ where: { id: Number(request.params.contactId) } });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }
      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { editLinkLocked: !!request.body.locked },
      });
      return serializeContact(updated);
    },
  );

  // DELETE /api/admin/sponsors/:id/contacts/:contactId — remove a contact.
  app.delete<{ Params: SponsorIdParams & { contactId: string } }>(
    "/sponsors/:id/contacts/:contactId",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({ where: { id: Number(request.params.contactId) } });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }
      await prisma.sponsorContact.delete({ where: { id: contact.id } });
      return reply.code(204).send();
    },
  );

  // DELETE /api/admin/sponsors/:id/job-offers/:offerId — moderate an offer (#251).
  // Job offers hang off the participation now (#129), not the identity
  // directly, so ownership is checked through `editionSponsor.sponsorId`.
  app.delete<{ Params: SponsorIdParams & { offerId: string } }>(
    "/sponsors/:id/job-offers/:offerId",
    { schema: { params: { type: "object", required: ["id", "offerId"], properties: { id: { type: "string" }, offerId: { type: "string" } } } } },
    async (request, reply) => {
      const offer = await prisma.sponsorJobOffer.findUnique({
        where: { id: Number(request.params.offerId) },
        include: { editionSponsor: { select: { sponsorId: true } } },
      });
      if (!offer || offer.editionSponsor.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Offer not found" });
      }
      await prisma.sponsorJobOffer.delete({ where: { id: offer.id } });
      revalidateSponsors();
      revalidateJobOffers();
      return reply.code(204).send();
    },
  );
}
