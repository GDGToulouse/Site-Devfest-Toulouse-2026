import type { Metadata } from "next";

// The volunteers' event-day zone (#640): private, and its invitation pages
// carry a token in the path. noindex for the reason given in sponsor/layout.tsx.
export const metadata: Metadata = {
  title: "Accueil des participants — DevFest Toulouse",
  robots: { index: false, follow: false },
};

export default function ArrivalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
