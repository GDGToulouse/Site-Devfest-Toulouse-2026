// A page is as fresh as the most recently touched row behind it (#379).
//
// The sitemap used to send `new Date()` on nearly every entry, which claims
// "modified just now" at every crawl. A signal that is always true carries no
// information, and search engines end up ignoring it. Entities own an
// `updatedAt`, but a page rarely renders a single row: a sponsor page shows the
// company *and* its participations, so the later of the two dates the page.
export function mostRecent(...dates: (Date | null | undefined)[]): Date | null {
  const known = dates.filter((d): d is Date => d instanceof Date);
  if (known.length === 0) return null;
  return known.reduce((latest, d) => (d > latest ? d : latest));
}
