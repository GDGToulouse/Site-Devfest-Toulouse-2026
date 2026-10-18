/**
 * The address of a talk's page (#633). A talk of the featured edition lives at
 * /conferences/<slug>; its dated address only redirects there, so linking it
 * directly saves a hop and keeps one page per talk. Any other year keeps its
 * dated page (#343), the only one that serves it.
 */
export function talkPath(slug: string, year: number, featuredYear: number | null | undefined): string {
  return year === featuredYear ? `/conferences/${slug}` : `/editions/${year}/conferences/${slug}`;
}
