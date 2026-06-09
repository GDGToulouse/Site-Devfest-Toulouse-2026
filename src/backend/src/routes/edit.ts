import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { isEditingFrozen } from "../lib/edit-token.js";
import { revalidateSpeakers, revalidateSponsors } from "../lib/revalidate.js";

// Resolve a modification token to either a speaker or a sponsor. Returns null
// if no entity carries this token.
async function resolveToken(token: string) {
  const speaker = await prisma.speaker.findUnique({
    where: { editToken: token },
    include: { edition: { select: { startDate: true } } },
  });
  if (speaker) return { kind: "speaker" as const, entity: speaker };

  const sponsor = await prisma.sponsor.findUnique({
    where: { editToken: token },
    include: { edition: { select: { startDate: true } } },
  });
  if (sponsor) return { kind: "sponsor" as const, entity: sponsor };

  return null;
}

function parseSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" ? (p as Record<string, string>) : {};
  } catch {
    return {};
  }
}

interface SpeakerEditBody {
  bioFr?: string;
  bioEn?: string;
  company?: string;
  city?: string;
  photoUrl?: string;
  socialLinks?: Record<string, string>;
}
interface SponsorEditBody {
  descriptionFr?: string;
  descriptionEn?: string;
  websiteUrl?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
}

export default async function editRoutes(app: FastifyInstance) {
  // GET /api/edit/:token — load the editable fields of the entity behind the token.
  app.get<{ Params: { token: string } }>("/edit/:token", {
    schema: { params: { type: "object", required: ["token"], properties: { token: { type: "string" } } } },
  }, async (request, reply) => {
    const resolved = await resolveToken(request.params.token);
    // Invalid/unknown token -> 404 (RG-249 cas limite).
    if (!resolved) return reply.code(404).send({ error: "invalid_token" });

    const { kind, entity } = resolved;
    // Locked (RG-245) or frozen 48h before the event (RG-246) -> 403 with reason.
    if (entity.editLinkLocked) return reply.code(403).send({ error: "locked" });
    if (isEditingFrozen(entity.edition.startDate)) return reply.code(403).send({ error: "frozen" });

    if (kind === "speaker") {
      return {
        kind,
        name: entity.name,
        fields: {
          bioFr: entity.bioFr,
          bioEn: entity.bioEn,
          company: entity.company,
          city: entity.city,
          photoUrl: entity.photoUrl,
          socialLinks: parseSocial(entity.socialLinks),
        },
      };
    }
    return {
      kind,
      name: entity.name,
      fields: {
        descriptionFr: entity.descriptionFr,
        descriptionEn: entity.descriptionEn,
        websiteUrl: entity.websiteUrl,
        logoUrl: entity.logoUrl,
        socialLinks: parseSocial(entity.socialLinks),
      },
    };
  });

  // PUT /api/edit/:token — save the editable fields. Name, sessions, level and
  // publication status are NOT editable here (RG-247).
  app.put<{ Params: { token: string }; Body: SpeakerEditBody | SponsorEditBody }>("/edit/:token", {
    schema: { params: { type: "object", required: ["token"], properties: { token: { type: "string" } } } },
  }, async (request, reply) => {
    const resolved = await resolveToken(request.params.token);
    if (!resolved) return reply.code(404).send({ error: "invalid_token" });

    const { kind, entity } = resolved;
    if (entity.editLinkLocked) return reply.code(403).send({ error: "locked" });
    if (isEditingFrozen(entity.edition.startDate)) return reply.code(403).send({ error: "frozen" });

    if (kind === "speaker") {
      const body = request.body as SpeakerEditBody;
      await prisma.speaker.update({
        where: { id: entity.id },
        data: {
          ...(body.bioFr !== undefined && { bioFr: body.bioFr || null }),
          ...(body.bioEn !== undefined && { bioEn: body.bioEn || null }),
          ...(body.company !== undefined && { company: body.company || null }),
          ...(body.city !== undefined && { city: body.city || null }),
          ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
          ...(body.socialLinks !== undefined && {
            socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
          }),
        },
      });
      revalidateSpeakers();
    } else {
      const body = request.body as SponsorEditBody;
      await prisma.sponsor.update({
        where: { id: entity.id },
        data: {
          ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr || null }),
          ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn || null }),
          ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
          ...(body.socialLinks !== undefined && {
            socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
          }),
        },
      });
      revalidateSponsors();
    }

    return { saved: true };
  });
}
