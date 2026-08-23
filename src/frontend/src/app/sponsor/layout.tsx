import type { Metadata } from "next";

// The sponsor space is private, and two of its routes carry a token in the path
// — /sponsor/invitation/<token>, and /edit/<token> next door. All of it was
// crawlable: robots.ts only ever disallowed /admin (#466).
//
// noindex rather than a Disallow, and that order matters. A path blocked in
// robots.txt is never fetched, so the crawler never reads the noindex on it and
// can keep the URL indexed on the strength of an external link. To get a page
// *out* of the index, it has to be allowed to see the instruction. A Disallow
// only makes sense afterwards — and would then need `/sponsor$` and `/sponsor/`
// rather than `/sponsor`, which would also block the public `/sponsors`.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
