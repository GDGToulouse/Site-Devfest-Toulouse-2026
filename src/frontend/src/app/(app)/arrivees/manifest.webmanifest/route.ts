import type { MetadataRoute } from "next";

import { manifestIcons } from "@/lib/manifest-icons";

// The event-day zone installs as its own application (RG-ARR-63, #641): it
// opens on /arrivees, stays inside it, and its service worker
// (public/arrivees-sw.js) keeps it usable without the network.
export async function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/arrivees",
    name: "Accueil DevFest Toulouse",
    short_name: "Accueil DevFest",
    description: "Scan, guichets et aide du jour J, pour les bénévoles du DevFest Toulouse.",
    start_url: "/arrivees",
    scope: "/arrivees",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#109E6E",
    icons: await manifestIcons(),
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
