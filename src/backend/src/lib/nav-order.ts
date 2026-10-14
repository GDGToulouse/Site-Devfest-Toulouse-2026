// The order of the public menu's top-level entries (#606), as a list of slot
// keys: `programme`, `speakers`, `sponsors`, `venue`, `faq`, `blog`, and
// `page-<slug>` for a page placed in the menu. Which entries show still
// depends on the edition (src/frontend/src/lib/nav.ts); this only orders them.
// A key missing from the list goes last, so an entry added to the code later,
// or a newly placed page, appears without anyone touching the setting.

export const NAV_ORDER_KEY = "nav_order";

// Generous guard: the menu holds a handful of entries.
const NAV_ORDER_MAX = 50;
const SLOT_PATTERN = /^(programme|speakers|sponsors|venue|faq|blog|page-[a-z0-9-]+)$/;

export const navOrderSchema = {
  type: "array",
  maxItems: NAV_ORDER_MAX,
  uniqueItems: true,
  items: { type: "string", pattern: SLOT_PATTERN.source },
} as const;

// A stored value that does not parse is an empty order (the code's default),
// never an error on every page of the site.
export function parseNavOrder(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string" && SLOT_PATTERN.test(k)) : [];
  } catch {
    return [];
  }
}
