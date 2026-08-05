import { prisma } from "./prisma.js";
import { isInvitationExpired } from "./edit-token.js";

// Invitations to a sponsor space (#362).
//
// Sign-up stays closed: auth.ts rejects any email that is neither an admin nor
// the holder of a live invitation. This module answers that second question,
// and is the single place that decides what "live" means — so the sign-up hook
// and the acceptance route cannot drift apart on it.

// Addresses are compared normalized everywhere: an invitation sent to
// "Contact@Societe.fr" must match a Google account reporting
// "contact@societe.fr". Identity providers do not agree on casing.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// A pending invitation is one that was sent, has not expired, and has not been
// accepted yet. Accepted invitations stop opening the sign-up door: the account
// exists by then, so a second use would be a replay.
export async function findPendingInvitation(token: string) {
  const contact = await prisma.sponsorContact.findUnique({
    where: { invitationToken: token },
    include: { sponsor: { select: { id: true, name: true, slug: true, deletedAt: true } } },
  });
  if (!contact) return null;
  // A trashed company must not hand out access while it sits in the bin (#146).
  if (contact.sponsor.deletedAt) return null;
  if (contact.invitationAcceptedAt) return null;
  if (isInvitationExpired(contact.invitationSentAt)) return null;
  return contact;
}

// Does this email hold a live invitation? Asked by the sign-up hook, which runs
// before any User row exists and must not create one for an uninvited address.
export async function hasPendingInvitation(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const contacts = await prisma.sponsorContact.findMany({
    where: {
      invitationToken: { not: null },
      invitationAcceptedAt: null,
      sponsor: { deletedAt: null },
    },
    select: { email: true, invitationSentAt: true },
  });
  // Filtered in JS, not SQL: Postgres would compare raw values, and the stored
  // address may differ in case from what the provider reports.
  return contacts.some(
    (c) => normalizeEmail(c.email) === normalized && !isInvitationExpired(c.invitationSentAt),
  );
}
