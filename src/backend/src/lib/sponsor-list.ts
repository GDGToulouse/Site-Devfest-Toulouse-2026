// The back-office sponsor list (#574), on the model of the speakers' (#572):
// filters, sort and pagination answered by the API, with the follow-up
// questions of the weeks before the event — whose communication kit is still
// missing, whose logo for the year is missing, who has no access to the
// partner space yet, who has posted no job offer.

export const SPONSOR_SORTS = ["name", "tier", "status", "edition"] as const;
export const SPONSOR_MISSING = ["description", "website"] as const;
export type SponsorSort = (typeof SPONSOR_SORTS)[number];
export type SponsorMissing = (typeof SPONSOR_MISSING)[number];
export type ContactState = "none" | "pending" | "active";

export const SPONSOR_PAGE_SIZE = 50;
export const SPONSOR_PAGE_SIZE_MAX = 100;

export interface SponsorListFilters {
  search?: string;
  tierKey?: string;
  status?: "PUBLISHED" | "DRAFT";
  comKit?: "received" | "missing";
  logo?: "missing";
  contacts?: ContactState;
  jobOffers?: "with" | "without";
  missing: SponsorMissing[];
}

/** One row as the filters read it: the company and the participation of the year looked at. */
export interface SponsorListRow {
  name: string;
  tierKey: string | null;
  tierRank: number | null;
  status: "PUBLISHED" | "DRAFT" | null;
  year: number | null;
  comKitReceived: boolean;
  hasLogo: boolean;
  contactState: ContactState;
  jobOfferCount: number;
  hasDescription: boolean;
  hasWebsite: boolean;
}

/**
 * Where the company stands with the partner space (#362): nobody to invite,
 * invited but no account yet (expired invitations included — someone still
 * has to act), or at least one account open. Never the invitation token.
 */
export function contactState(contacts: { userId: string | null; invitationToken: string | null }[]): ContactState {
  if (contacts.some((c) => c.userId)) return "active";
  return contacts.length > 0 ? "pending" : "none";
}

export function matchesSponsor(row: SponsorListRow, f: SponsorListFilters): boolean {
  const search = f.search?.trim().toLowerCase();
  if (search && !row.name.toLowerCase().includes(search)) return false;
  if (f.tierKey && row.tierKey !== f.tierKey) return false;
  if (f.status && row.status !== f.status) return false;
  if (f.comKit && row.comKitReceived !== (f.comKit === "received")) return false;
  if (f.logo === "missing" && row.hasLogo) return false;
  if (f.contacts && row.contactState !== f.contacts) return false;
  if (f.jobOffers && (row.jobOfferCount > 0) !== (f.jobOffers === "with")) return false;
  if (f.missing.includes("description") && row.hasDescription) return false;
  if (f.missing.includes("website") && row.hasWebsite) return false;
  return true;
}

const byName = (a: SponsorListRow, b: SponsorListRow) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/**
 * Sorted in memory: tier, status and year live on the participation of the
 * year looked at, which Prisma cannot order a company by. A few dozen
 * sponsors a year make that cheap. The tier sorts by its rank, not by its label.
 */
export function sortSponsors<T extends SponsorListRow>(rows: T[], sort: SponsorSort, order: "asc" | "desc"): T[] {
  const sign = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let diff = 0;
    // Higher rank = more prominent (RG-221): ascending reads like the public
    // page, Platinum first, as the admin list sorted before (#498).
    if (sort === "tier") diff = (b.tierRank ?? -Infinity) - (a.tierRank ?? -Infinity);
    else if (sort === "status") diff = (a.status ?? "").localeCompare(b.status ?? "");
    else if (sort === "edition") diff = (a.year ?? 0) - (b.year ?? 0);
    else diff = byName(a, b);
    return sign * diff || byName(a, b);
  });
}
