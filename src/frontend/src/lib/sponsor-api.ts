// Client for a sponsor's own space (#362). Separate from admin-api.ts: that one
// prefixes /api/admin and is meant for the organisers, whose accounts hold a
// back-office role. A sponsor account holds none — its rights come from its
// SponsorContact — so these calls go to /api/sponsor-space/*.

export type SponsorAccessRole = "RESPONSABLE" | "EDITEUR" | "STAND";

export interface SponsorSpaceSummary {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  accessRole: SponsorAccessRole;
}

export interface SponsorSpaceParticipation {
  editionId: number;
  edition: { year: number };
  publicationStatus: "DRAFT" | "PUBLISHED";
  tier: { key: string; nameFr: string; nameEn: string };
}

export interface SponsorSpaceProfile {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  socialLinks: Record<string, string>;
  editions: SponsorSpaceParticipation[];
  accessRole: SponsorAccessRole;
}

export interface SponsorSpacePrivate {
  standContacts: { name?: string; linkedin?: string; twitter?: string; bluesky?: string }[];
  editions: {
    editionId: number;
    edition: { year: number };
    comKitReceived: boolean;
    comKitLogoWebUrl: string | null;
    comKitLogoPrintUrl: string | null;
    comKitCharterUrl: string | null;
    comKitNotes: string | null;
    platinumPromoIdea: string | null;
    platinumCoBuildIdea: string | null;
    tier: { allowsPromoIdeas: boolean };
  }[];
}

export interface SponsorTeamMember {
  id: number;
  email: string;
  name: string | null;
  // Free-text job title, not a permission — accessRole below carries the right.
  role: string | null;
  accessRole: SponsorAccessRole;
  hasAccount: boolean;
  invitationSentAt: string | null;
  invitationAcceptedAt: string | null;
}

export interface SponsorJobOffer {
  id: number;
  title: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  url: string;
}

export interface SponsorJobOffers {
  // How many offers this year's tier allows. A lowered tier keeps the offers
  // already published but blocks new ones beyond the new cap (#251).
  quota: number;
  offers: SponsorJobOffer[];
}

export interface InvitationPreview {
  sponsorName: string;
  accessRole: SponsorAccessRole;
  // Masked ("c•••••t@societe.fr") so a forwarded link does not hand the mailbox
  // to whoever opens it.
  emailHint: string;
}

interface Result<T> {
  data: T | null;
  status: number;
  error?: string;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  try {
    const headers: Record<string, string> = {};
    if (options.body) headers["Content-Type"] = "application/json";

    const res = await fetch(path, {
      credentials: "include",
      headers: { ...headers, ...options.headers },
      ...options,
    });

    if (res.status === 204) return { data: null, status: 204 };

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { data: null, status: res.status, ...(body?.error ? { error: body.error } : {}) };
    }

    return { data: (await res.json()) as T, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export function getMySponsorSpaces() {
  return call<SponsorSpaceSummary[]>("/api/sponsor-space/mine");
}

export function getSponsorProfile(sponsorId: number) {
  return call<SponsorSpaceProfile>(`/api/sponsor-space/${sponsorId}`);
}

export function getSponsorPrivate(sponsorId: number) {
  return call<SponsorSpacePrivate>(`/api/sponsor-space/${sponsorId}/private`);
}

export function saveSponsorProfile(sponsorId: number, body: Record<string, unknown>) {
  return call<{ saved: boolean }>(`/api/sponsor-space/${sponsorId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getSponsorTeam(sponsorId: number) {
  return call<SponsorTeamMember[]>(`/api/sponsor-space/${sponsorId}/team`);
}

export function inviteTeamMember(
  sponsorId: number,
  body: { email: string; name?: string; accessRole: SponsorAccessRole },
) {
  return call<SponsorTeamMember>(`/api/sponsor-space/${sponsorId}/team`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function setTeamMemberRole(sponsorId: number, contactId: number, accessRole: SponsorAccessRole) {
  return call<SponsorTeamMember>(`/api/sponsor-space/${sponsorId}/team/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ accessRole }),
  });
}

export function revokeTeamMember(sponsorId: number, contactId: number) {
  return call<null>(`/api/sponsor-space/${sponsorId}/team/${contactId}`, { method: "DELETE" });
}

export function getSponsorJobOffers(sponsorId: number) {
  return call<SponsorJobOffers>(`/api/sponsor-space/${sponsorId}/job-offers`);
}

export function createSponsorJobOffer(sponsorId: number, body: Omit<SponsorJobOffer, "id">) {
  return call<SponsorJobOffer>(`/api/sponsor-space/${sponsorId}/job-offers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateSponsorJobOffer(
  sponsorId: number,
  offerId: number,
  body: Partial<Omit<SponsorJobOffer, "id">>,
) {
  return call<SponsorJobOffer>(`/api/sponsor-space/${sponsorId}/job-offers/${offerId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteSponsorJobOffer(sponsorId: number, offerId: number) {
  return call<null>(`/api/sponsor-space/${sponsorId}/job-offers/${offerId}`, { method: "DELETE" });
}

// Outside call(): that helper forces Content-Type: application/json, which would
// strip the multipart boundary the browser sets for us.
export async function uploadSponsorFile(sponsorId: number, file: File): Promise<Result<{ url: string }>> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/sponsor-space/${sponsorId}/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { data: null, status: res.status, ...(body?.error ? { error: body.error } : {}) };
    }
    return { data: (await res.json()) as { url: string }, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

// Open the account an invitation entitles someone to (#362). Distinct from
// signInWithEmail, which only authenticates an account that already exists —
// a sponsor arriving from an invitation has none yet.
//
// The server accepts this only for an address holding a live invitation; any
// other one is refused by the user.create.before hook in auth.ts.
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (res.ok) return { success: true };

    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { success: false, error: body?.message || "La création du compte a échoué." };
  } catch {
    return { success: false, error: "Impossible de contacter le serveur." };
  }
}

// Ask for a sign-in link by email (#362). better-auth's magic-link plugin runs
// with disableSignUp, so this never creates an account: an address with no
// account gets the same answer as one that has it, which is deliberate — the
// endpoint must not become a way to probe who is registered.
export async function requestMagicLink(email: string, callbackURL: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, callbackURL }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function getInvitationPreview(token: string) {
  return call<InvitationPreview>(`/api/sponsor-invitation/${token}`);
}

export function acceptInvitation(token: string) {
  return call<{ sponsorId: number; sponsorSlug: string; accessRole: SponsorAccessRole }>(
    `/api/sponsor-invitation/${token}/accept`,
    { method: "POST" },
  );
}
