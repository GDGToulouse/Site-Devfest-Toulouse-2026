import type { Metadata } from "next";

// The speaker edit link is a token in the path, and it was crawlable (#466).
// See the sponsor layout beside this one for why this is a noindex and not a
// robots.txt Disallow.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
