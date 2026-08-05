import { prisma } from "./prisma.js";
import { sanitizeRichHtml } from "./sanitize.js";
import { revalidateSponsor, revalidateSponsors } from "./revalidate.js";

// Applying a sponsor's own edits, shared by the two ways in (#362): the edit
// link (/api/edit/:token, still in service) and the account-based space
// (/api/sponsor-space/:id). Both write the same fields under the same rules —
// keeping one copy is what stops them from drifting apart on which field is
// per-year and which belongs to the company.

// Booth staff whose social handles the organisers relay on the day (#249).
export interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

export interface SponsorEditBody {
  descriptionFr?: string;
  descriptionEn?: string;
  websiteUrl?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
  standContacts?: StandContact[];
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string;
  comKitLogoPrintUrl?: string;
  comKitCharterUrl?: string;
  comKitNotes?: string;
  platinumPromoIdea?: string;
  platinumCoBuildIdea?: string;
}

// Fields stored on the participation, not on the company. Writing one with no
// participation for the target edition has nowhere sane to land: silently
// writing to another year would be worse than refusing (#249, #252, #375).
export function writesYearField(body: SponsorEditBody): boolean {
  return (
    body.logoUrl !== undefined ||
    body.comKitReceived !== undefined ||
    body.comKitLogoWebUrl !== undefined ||
    body.comKitLogoPrintUrl !== undefined ||
    body.comKitCharterUrl !== undefined ||
    body.comKitNotes !== undefined ||
    body.platinumPromoIdea !== undefined ||
    body.platinumCoBuildIdea !== undefined
  );
}

// Whether anything visible on the public site changed. A private-only save (com
// kit, booth staff) needs no cache revalidation.
export function touchesPublicFields(body: SponsorEditBody): boolean {
  return (
    body.descriptionFr !== undefined ||
    body.descriptionEn !== undefined ||
    body.websiteUrl !== undefined ||
    body.logoUrl !== undefined ||
    body.socialLinks !== undefined
  );
}

// Empty values are dropped rather than stored: a social block full of blank
// strings would render as empty links on the public page.
export function cleanSocial(social: Record<string, string> | undefined): string | null {
  if (!social) return null;
  const kept = Object.entries(social).filter(([, v]) => typeof v === "string" && v.trim());
  return kept.length ? JSON.stringify(Object.fromEntries(kept)) : null;
}

export function cleanStandContacts(contacts: StandContact[] | undefined): string | null {
  if (!contacts) return null;
  const kept = contacts
    .map((c) => {
      const entry: StandContact = {};
      for (const key of ["name", "linkedin", "twitter", "bluesky"] as const) {
        const v = c[key];
        if (typeof v === "string" && v.trim()) entry[key] = v.trim();
      }
      return entry;
    })
    .filter((c) => Object.keys(c).length > 0);
  return kept.length ? JSON.stringify(kept) : null;
}

export async function applySponsorEdit(opts: {
  sponsorId: number;
  sponsorSlug: string;
  participation: { id: number; tier: { allowsPromoIdeas: boolean } } | null;
  body: SponsorEditBody;
}) {
  const { sponsorId, sponsorSlug, participation, body } = opts;

  await prisma.sponsor.update({
    where: { id: sponsorId },
    data: {
      // Rich-text HTML (#270): sanitized on write, like article content.
      ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) || null }),
      ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) || null }),
      ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
      // The company's current logo tracks the latest one it sent (#375), so a
      // future participation starts from it. What each edition displays is the
      // copy frozen on its own participation, below.
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
      ...(body.socialLinks !== undefined && { socialLinks: cleanSocial(body.socialLinks) }),
      // Booth staffing is not per-year, so it stays on the identity (#249).
      ...(body.standContacts !== undefined && { standContacts: cleanStandContacts(body.standContacts) }),
    },
  });

  // Skipped entirely when no per-year field was sent: EditionSponsor has
  // @updatedAt, so an empty `data: {}` would still bump the participation's
  // timestamp — and cost a round-trip — on every identity-only save.
  if (participation && writesYearField(body)) {
    await prisma.editionSponsor.update({
      where: { id: participation.id },
      data: {
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.comKitReceived !== undefined && { comKitReceived: body.comKitReceived }),
        ...(body.comKitLogoWebUrl !== undefined && { comKitLogoWebUrl: body.comKitLogoWebUrl || null }),
        ...(body.comKitLogoPrintUrl !== undefined && { comKitLogoPrintUrl: body.comKitLogoPrintUrl || null }),
        ...(body.comKitCharterUrl !== undefined && { comKitCharterUrl: body.comKitCharterUrl || null }),
        ...(body.comKitNotes !== undefined && { comKitNotes: body.comKitNotes || null }),
        // Ignored for tiers that don't allow them (#252), so the field cannot
        // be set by tampering with the payload.
        ...(participation.tier.allowsPromoIdeas && body.platinumPromoIdea !== undefined && {
          platinumPromoIdea: body.platinumPromoIdea || null,
        }),
        ...(participation.tier.allowsPromoIdeas && body.platinumCoBuildIdea !== undefined && {
          platinumCoBuildIdea: body.platinumCoBuildIdea || null,
        }),
      },
    });
  }

  if (touchesPublicFields(body)) {
    revalidateSponsors();
    // The company's own page too (#360) — someone editing is precisely who
    // watches for their change to appear.
    revalidateSponsor(sponsorSlug);
  }
}
