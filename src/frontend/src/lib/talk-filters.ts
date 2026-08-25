import { localizedField } from "./i18n-helpers";

// The session filters, shared by the list (#107) and the grid (#448).
//
// Both views filter the same sessions on the same four families, and a
// selection made in one has to hold in the other — so the predicate lives here
// rather than being written twice and drifting.

export interface TalkFilters {
  /** Free-text search. The grid has no search field and passes an empty one. */
  q: string;
  format: string;
  level: string;
  language: string;
  /**
   * The localized category *name*, not a slug: the public payload carries no
   * slug for categories, so the chip value is what the chip shows (#107).
   */
  category: string;
}

export const EMPTY_FILTERS: TalkFilters = {
  q: "",
  format: "",
  level: "",
  language: "",
  category: "",
};

/** The least a session must expose to be filtered. */
export interface FilterableTalk {
  title: string;
  format: string;
  level: string | null;
  language: string;
  category: { nameFr: string; nameEn: string } | null;
  speakers: { name: string }[];
}

export function matchesFilters(
  talk: FilterableTalk,
  filters: TalkFilters,
  locale: string,
): boolean {
  if (filters.format && talk.format !== filters.format) return false;
  if (filters.level && talk.level !== filters.level) return false;
  if (filters.language && talk.language !== filters.language) return false;
  if (filters.category) {
    const name = talk.category ? localizedField(talk.category, "name", locale) : "";
    if (name !== filters.category) return false;
  }

  const q = filters.q.trim().toLowerCase();
  if (q) {
    const title = talk.title.toLowerCase();
    const speakers = talk.speakers.map((s) => s.name).join(" ").toLowerCase();
    if (!title.includes(q) && !speakers.includes(q)) return false;
  }

  return true;
}

export function hasActiveFilter(filters: TalkFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/**
 * How many filters to announce on the collapsed mobile panel (#256).
 *
 * `families` names what the view actually renders: the grid offers no search
 * field, and the language chips only appear when an edition has more than one
 * language — counting a filter the visitor cannot see would leave them hunting
 * for it.
 */
export function activeFilterCount(
  filters: TalkFilters,
  families: (keyof TalkFilters)[],
): number {
  return families.filter((family) => filters[family]).length;
}

/** Read the filters a shared link carries. */
export function parseFilters(
  read: (key: string) => string | undefined,
): TalkFilters {
  return {
    q: read("q") ?? "",
    format: read("format") ?? "",
    level: read("level") ?? "",
    language: read("language") ?? "",
    category: read("category") ?? "",
  };
}

/** Write them back, dropping the empty ones so the URL stays readable. */
export function applyFiltersToParams(params: URLSearchParams, filters: TalkFilters): void {
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
}
