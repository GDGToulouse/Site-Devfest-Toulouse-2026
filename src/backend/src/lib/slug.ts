// Derive a URL-safe slug from a free-text name: lowercase, strip accents,
// collapse non-alphanumerics into single hyphens, trim edge hyphens.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Make `base` unique against an existing set by appending -2, -3, ... until free
// (RG-206/RG-227: slugs are unique per edition; duplicates are deduplicated).
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
