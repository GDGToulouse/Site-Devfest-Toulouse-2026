import type { Prisma } from "../generated/prisma/client.js";
import { notDeleted } from "./admin-helpers.js";

// The back-office speaker list (#572): filters, sort and pagination answered by
// the API, so the page only asks for what it shows. The questions are the ones
// the team asks before the event — who is still a draft, who misses a photo or
// an email, who never got their edit link, who is on the edition with no talk.

export const SPEAKER_SORTS = ["name", "company", "status", "talks"] as const;
export const SPEAKER_MISSING = ["photo", "bio", "email"] as const;
export const EDIT_LINK_STATES = ["never", "sent", "locked", "revoked"] as const;

export type SpeakerSort = (typeof SPEAKER_SORTS)[number];
export type SpeakerMissing = (typeof SPEAKER_MISSING)[number];
export type EditLinkState = (typeof EDIT_LINK_STATES)[number];

export const SPEAKER_PAGE_SIZE = 50;
export const SPEAKER_PAGE_SIZE_MAX = 100;

export interface SpeakerListFilters {
  search?: string;
  editionId?: number;
  status?: "PUBLISHED" | "DRAFT";
  talks?: "with" | "without";
  missing: SpeakerMissing[];
  editLink?: EditLinkState;
  sort: SpeakerSort;
  order: "asc" | "desc";
}

const blank = (field: "photoUrl" | "contactEmail" | "bioFr" | "bioEn") => ({
  OR: [{ [field]: null }, { [field]: "" }],
});

/** The `where` of the list. Status and talks read the chosen edition only (#351). */
export function speakerWhere(f: SpeakerListFilters): Prisma.SpeakerWhereInput {
  const and: Prisma.SpeakerWhereInput[] = [notDeleted];
  const search = f.search?.trim();
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (f.editionId) {
    and.push({
      editions: { some: { editionId: f.editionId, ...(f.status ? { publicationStatus: f.status } : {}) } },
    });
    const talkOfEdition = { editionId: f.editionId, ...notDeleted };
    if (f.talks === "with") and.push({ talks: { some: talkOfEdition } });
    if (f.talks === "without") and.push({ talks: { none: talkOfEdition } });
  }
  if (f.missing.includes("photo")) and.push(blank("photoUrl"));
  if (f.missing.includes("email")) and.push(blank("contactEmail"));
  // No bio in either language: one of the two is enough for the public page.
  if (f.missing.includes("bio")) and.push(blank("bioFr"), blank("bioEn"));
  // Same precedence as editLinkState below, so a row always matches its own badge.
  if (f.editLink === "locked") and.push({ editLinkLocked: true });
  if (f.editLink === "never") and.push({ editLinkLocked: false, editTokenSentAt: null });
  if (f.editLink === "revoked") and.push({ editLinkLocked: false, editTokenSentAt: { not: null }, editToken: null });
  if (f.editLink === "sent") and.push({ editLinkLocked: false, editTokenSentAt: { not: null }, editToken: { not: null } });
  return { AND: and };
}

/** Where the speaker's edit link stands — never the token itself. */
export function editLinkState(s: { editLinkLocked: boolean; editTokenSentAt: Date | null; editToken: string | null }): EditLinkState {
  if (s.editLinkLocked) return "locked";
  if (!s.editTokenSentAt) return "never";
  return s.editToken ? "sent" : "revoked";
}

interface SortableRow {
  name: string;
  company: string | null;
  status: "PUBLISHED" | "DRAFT" | null;
  talkCount: number;
}

const byName = (a: SortableRow, b: SortableRow) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/**
 * Sorts in memory rather than in SQL: the status lives on the participation of
 * the chosen edition and the talk count on a filtered relation, neither of which
 * Prisma can order by. The table holds a few hundred people, growing by about
 * forty a year, so the whole filtered set is cheap to sort.
 */
export function sortSpeakers<T extends SortableRow>(rows: T[], sort: SpeakerSort, order: "asc" | "desc"): T[] {
  const sign = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let diff = 0;
    if (sort === "company") {
      // No company sorts last whichever the direction: an empty cell first is noise.
      if (!a.company || !b.company) diff = a.company ? -1 : b.company ? 1 : 0;
      else diff = sign * a.company.localeCompare(b.company, "fr", { sensitivity: "base" });
      if (!a.company || !b.company) return diff || byName(a, b);
    } else if (sort === "status") {
      diff = sign * ((a.status ?? "").localeCompare(b.status ?? ""));
    } else if (sort === "talks") {
      diff = sign * (a.talkCount - b.talkCount);
    } else {
      diff = sign * byName(a, b);
    }
    return diff || byName(a, b);
  });
}
