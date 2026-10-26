import type { Prisma, SponsorGuest } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { EVENT_TIME_ZONE, parseWallTime } from "./zoned-time.js";

// Sponsor guest registration (#727, docs/specs/inscriptions-sponsors.md): the
// rules every screen shares — the quota, who fits in it, and when sponsors may
// still write. Routes for the sponsor space and the back-office both read here,
// so the two cannot disagree on who is out of quota.

export const GUEST_GENDERS = ["FEMALE", "MALE", "UNSPECIFIED"] as const;
export const GUEST_EXPERIENCES = ["STUDENT", "UNDER_3_YEARS", "FROM_3_TO_7_YEARS", "OVER_7_YEARS"] as const;
export const GUEST_DIETS = ["NONE", "VEGETARIAN", "VEGAN", "OTHER"] as const;
export const ADJUSTMENT_REASONS = ["PURCHASED", "GOODWILL", "CORRECTION"] as const;

const NAME_MAX = 100;
const EMAIL_MAX = 254;

// Same shape for the sponsor space and the back-office: one person, every field
// required but the three that default (RG-INS-20).
export const guestBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["lastName", "firstName", "email", "gender", "experience"],
  properties: {
    lastName: { type: "string", minLength: 1, maxLength: NAME_MAX },
    firstName: { type: "string", minLength: 1, maxLength: NAME_MAX },
    email: { type: "string", minLength: 3, maxLength: EMAIL_MAX },
    gender: { type: "string", enum: GUEST_GENDERS },
    experience: { type: "string", enum: GUEST_EXPERIENCES },
    attendsAfterParty: { type: "boolean" },
    diet: { type: "string", enum: GUEST_DIETS },
    needsAssistance: { type: "boolean" },
  },
} as const;

export interface GuestBody {
  lastName: string;
  firstName: string;
  email: string;
  gender: (typeof GUEST_GENDERS)[number];
  experience: (typeof GUEST_EXPERIENCES)[number];
  attendsAfterParty?: boolean;
  diet?: (typeof GUEST_DIETS)[number];
  needsAssistance?: boolean;
}

// Deliberately loose: the address goes to Billetweb, which mails the ticket,
// and a stricter pattern only refuses real addresses.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The normalized row to store, or the name of the field that is wrong. */
export function guestData(body: GuestBody): { data: Omit<Prisma.SponsorGuestUncheckedCreateInput, "editionSponsorId"> } | { field: string } {
  const lastName = body.lastName.trim();
  const firstName = body.firstName.trim();
  const email = body.email.trim();
  if (!lastName) return { field: "lastName" };
  if (!firstName) return { field: "firstName" };
  if (!EMAIL_SHAPE.test(email)) return { field: "email" };
  return {
    data: {
      lastName,
      firstName,
      email,
      gender: body.gender,
      experience: body.experience,
      attendsAfterParty: body.attendsAfterParty ?? false,
      diet: body.diet ?? "NONE",
      needsAssistance: body.needsAssistance ?? false,
    },
  };
}

// --- Deadline and opening ---

/**
 * The default deadline (RG-INS-21): the Friday before the edition starts, at
 * 23:59 on the venue's clocks. Read in Paris time, since the container runs in
 * UTC and an event starting at 9:00 is still the previous day in UTC at 0:30.
 */
export function defaultGuestDeadline(startDate: Date | null): Date | null {
  if (!startDate) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startDate);
  const [year, month, day] = parts.split("-").map(Number);
  const local = new Date(Date.UTC(year, month - 1, day));
  // Back to the previous Friday, strictly before: an event on a Friday closes
  // registration a week earlier, not on the day.
  const daysBack = ((local.getUTCDay() - 5 + 7) % 7) || 7;
  local.setUTCDate(local.getUTCDate() - daysBack);
  const wall = `${local.toISOString().slice(0, 10)}T23:59:00`;
  return parseWallTime(wall);
}

export interface RegistrationEdition {
  id: number;
  startDate: Date | null;
  isSponsorGuestRegistrationOpen: boolean;
  sponsorGuestRegistrationOpenedAt: Date | null;
  sponsorGuestDeadline: Date | null;
}

export const registrationEditionSelect = {
  id: true,
  startDate: true,
  isSponsorGuestRegistrationOpen: true,
  sponsorGuestRegistrationOpenedAt: true,
  sponsorGuestDeadline: true,
} as const;

export function registrationState(edition: RegistrationEdition, now: Date = new Date()) {
  const deadline = edition.sponsorGuestDeadline ?? defaultGuestDeadline(edition.startDate);
  const isPastDeadline = deadline !== null && now.getTime() > deadline.getTime();
  return {
    isOpen: edition.isSponsorGuestRegistrationOpen,
    // Never opened: the sponsor space hides the section (RG-INS-28).
    hasEverOpened: edition.sponsorGuestRegistrationOpenedAt !== null,
    deadline,
    isDeadlineDefault: edition.sponsorGuestDeadline === null,
    isPastDeadline,
    // Sponsors write only while both hold (RG-INS-22); the team always may.
    canSponsorWrite: edition.isSponsorGuestRegistrationOpen && !isPastDeadline,
  };
}

// --- Quota and ranking ---

type GuestRow = Pick<SponsorGuest, "id" | "email" | "createdAt" | "billetwebTicketId">;

/**
 * Who fits in the quota (RG-INS-13): guests ranked by registration, then id,
 * the first `quota` in. Computed every time rather than stored, so a raised
 * quota brings the last ones back and a bug cannot leave a stale flag behind.
 */
export function rankGuests<T extends GuestRow>(guests: T[], quota: number) {
  const ordered = [...guests].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
  // The same address twice at one sponsor is allowed but flagged (RG-INS-25):
  // the tickets of both go to one inbox.
  const countByEmail = new Map<string, number>();
  for (const g of ordered) {
    const key = g.email.toLowerCase();
    countByEmail.set(key, (countByEmail.get(key) ?? 0) + 1);
  }
  return ordered.map((guest, index) => ({
    ...guest,
    rank: index + 1,
    isWithinQuota: index < quota,
    hasDuplicateEmail: (countByEmail.get(guest.email.toLowerCase()) ?? 0) > 1,
  }));
}

export function quotaOf(basePlaces: number, adjustments: Array<{ quantity: number }>) {
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.quantity, 0);
  return { basePlaces, adjustmentTotal, quota: Math.max(0, basePlaces + adjustmentTotal) };
}

/** The places the participation's offer gives this year (RG-INS-10). */
export async function basePlacesOf(
  participation: { editionId: number; tierId: number },
  // The shared client or a transaction of it: both have the extensions (audit.ts).
  client: Pick<typeof prisma, "editionSponsorTier"> = prisma,
) {
  const offer = await client.editionSponsorTier.findUnique({
    where: { editionId_tierId: { editionId: participation.editionId, tierId: participation.tierId } },
    select: { guestPlaces: true },
  });
  return offer?.guestPlaces ?? 0;
}

export const guestSelect = {
  id: true,
  lastName: true,
  firstName: true,
  email: true,
  gender: true,
  experience: true,
  attendsAfterParty: true,
  diet: true,
  needsAssistance: true,
  billetwebTicketId: true,
  billetwebSyncedAt: true,
  billetwebError: true,
  isBilletwebCancelled: true,
  createdAt: true,
} as const;

/** A participation's guests and quota, ranked: what every guest screen shows. */
export async function loadGuestBook(editionSponsorId: number) {
  const participation = await prisma.editionSponsor.findUniqueOrThrow({
    where: { id: editionSponsorId },
    select: {
      editionId: true,
      tierId: true,
      guests: { select: guestSelect },
      guestAdjustments: {
        select: {
          id: true,
          quantity: true,
          reason: true,
          comment: true,
          createdAt: true,
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const quota = quotaOf(await basePlacesOf(participation), participation.guestAdjustments);
  const guests = rankGuests(participation.guests, quota.quota);
  return {
    ...quota,
    registeredCount: guests.length,
    remaining: Math.max(0, quota.quota - guests.length),
    outOfQuotaCount: guests.filter((g) => !g.isWithinQuota).length,
    adjustments: participation.guestAdjustments,
    guests,
  };
}

export class QuotaExceededError extends Error {
  constructor(readonly remaining: number) {
    super("Sponsor guest quota exceeded");
  }
}

/**
 * Adds guests to a participation. With `enforceQuota`, the whole batch is
 * refused when it does not fit (RG-INS-14, RG-INS-34). The participation row is
 * locked for the count and the insert, so two sponsors' colleagues taking the
 * last place at the same moment cannot both get it.
 */
export async function addGuests(
  participation: { id: number; editionId: number; tierId: number },
  rows: Array<Omit<Prisma.SponsorGuestUncheckedCreateInput, "editionSponsorId">>,
  { enforceQuota }: { enforceQuota: boolean },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "EditionSponsor" WHERE id = ${participation.id} FOR UPDATE`;
    if (enforceQuota) {
      const [count, adjustments, basePlaces] = await Promise.all([
        tx.sponsorGuest.count({ where: { editionSponsorId: participation.id } }),
        tx.sponsorGuestAdjustment.findMany({ where: { editionSponsorId: participation.id }, select: { quantity: true } }),
        basePlacesOf(participation, tx),
      ]);
      const remaining = Math.max(0, quotaOf(basePlaces, adjustments).quota - count);
      if (rows.length > remaining) throw new QuotaExceededError(remaining);
    }
    const created = [];
    // One by one: createMany would not return the rows, and createdAt must
    // follow the batch's order for the ranking. A batch is a CSV of a few
    // dozen lines at most.
    for (const row of rows) {
      created.push(
        await tx.sponsorGuest.create({ data: { ...row, editionSponsorId: participation.id }, select: { id: true } }),
      );
    }
    return created;
  });
}
