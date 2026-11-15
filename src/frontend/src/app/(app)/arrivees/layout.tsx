import type { Metadata } from "next";

import ServiceWorkerRegistration from "@/components/arrivals/ServiceWorkerRegistration";

// The volunteers' event-day zone (#640): private, and its invitation pages
// carry a token in the path. noindex for the reason given in sponsor/layout.tsx.
// It installs on the home screen as its own application (RG-ARR-63, #641).
export const metadata: Metadata = {
  title: "Accueil des participants — DevFest Toulouse",
  robots: { index: false, follow: false },
  manifest: "/arrivees/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Accueil DevFest", statusBarStyle: "default" },
};

export default function ArrivalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      {children}
    </>
  );
}
