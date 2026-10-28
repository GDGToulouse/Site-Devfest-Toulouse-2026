import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { isInvitationExpired } from "./edit-token.js";
import { normalizeEmail } from "./sponsor-invitation.js";

// The "arrivals" permission (RG-ARR-21 to RG-ARR-24, #640): who may open the
// event-day screens of an edition. A sibling of sponsor-invitation.ts, and the
// single place that decides what a live volunteer invitation is, so the sign-up
// hook and the acceptance route cannot drift apart on it.

/** Most addresses one paste may hold: a volunteer team is about forty. */
export const MAX_INVITED_PER_BATCH = 200;

// Same rule as the back-office sidebar (components/admin/current-edition.ts):
// the edition in its last stretch or announced, else in preparation, else the
// latest. Kept in step by hand — the two apps share no code.
const CURRENT_STATUSES = ["EVENT_DAY", "PROGRAMME", "TICKETING", "ANNOUNCEMENT"];

export async function findCurrentEdition() {
  const editions = await prisma.edition.findMany({
    where: notDeleted,
    select: { id: true, year: true, status: true },
    orderBy: { year: "desc" },
  });
  return (
    editions.find((e) => CURRENT_STATUSES.includes(e.status)) ??
    editions.find((e) => e.status === "PREPARATION") ??
    editions[0] ??
    null
  );
}

/** ADMIN always; anyone else only with an accepted permission on that edition. */
export async function canAccessArrivals(user: { id: string; role: string }, editionId: number): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const access = await prisma.arrivalsAccess.findFirst({ where: { editionId, userId: user.id }, select: { id: true } });
  return access !== null;
}

// Sent, not expired, not accepted, on an edition still out of the bin.
export async function findPendingArrivalsInvitation(token: string) {
  const access = await prisma.arrivalsAccess.findUnique({
    where: { invitationToken: token },
    include: { edition: { select: { id: true, year: true, deletedAt: true } } },
  });
  if (!access || access.edition.deletedAt) return null;
  if (access.invitationAcceptedAt || access.userId) return null;
  if (isInvitationExpired(access.invitationSentAt)) return null;
  return access;
}

// Asked by the sign-up hook, before any User row exists. Emails are stored
// normalized here, so the database can compare them.
export async function hasPendingArrivalsInvitation(email: string): Promise<boolean> {
  const rows = await prisma.arrivalsAccess.findMany({
    where: {
      email: normalizeEmail(email),
      invitationToken: { not: null },
      userId: null,
      edition: { deletedAt: null },
    },
    select: { invitationSentAt: true },
  });
  return rows.some((r) => !isInvitationExpired(r.invitationSentAt));
}

// Loose on purpose: the provider and the mail server have the last word. This
// only sets aside what is plainly not an address (a name, a stray word).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedEmailList {
  emails: string[];
  invalid: string[];
  duplicates: string[];
}

/**
 * A pasted list (RG-ARR-23): entries split on lines, commas or semicolons,
 * addresses normalized, with what is malformed or repeated set aside — never a
 * reason to refuse the rest. "Jean Dupont <jean@x.fr>" keeps the address; an
 * entry with no address at all is reported, not dropped, since it is most
 * likely one with a typo.
 */
export function parseEmailList(raw: string): ParsedEmailList {
  const result: ParsedEmailList = { emails: [], invalid: [], duplicates: [] };
  const seen = new Set<string>();
  for (const entry of raw.split(/[\n,;]+/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const candidates = trimmed
      .split(/\s+/)
      .map((word) => word.replace(/^[<"'(]+|[>"')]+$/g, ""))
      .filter((word) => word.includes("@"));
    if (candidates.length === 0) {
      result.invalid.push(trimmed);
      continue;
    }
    for (const candidate of candidates) {
      const email = normalizeEmail(candidate);
      if (email.length > 254 || !EMAIL_SHAPE.test(email)) {
        result.invalid.push(candidate);
      } else if (seen.has(email)) {
        result.duplicates.push(email);
      } else {
        seen.add(email);
        result.emails.push(email);
      }
    }
  }
  return result;
}
