import type { MetadataRoute } from "next";

import { getIdentitySettings } from "@/lib/api";

// Basic web app manifest (#234): enables "Add to Home Screen" on Android and,
// with the layout's theme-color, a branded mobile toolbar. Not a full PWA —
// no service worker, no offline mode.
//
// Icons reuse the admin-configurable favicons (identity_favicon_png_192/512),
// falling back to the bundled logo so the manifest is always valid.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const identity = await getIdentitySettings();
  const fallback = "/images/logo-devfest-96.png";

  const icons: MetadataRoute.Manifest["icons"] = [
    {
      src: identity.identity_favicon_png_192 || fallback,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: identity.identity_favicon_png_512 || identity.identity_favicon_png_192 || fallback,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ];

  return {
    name: "DevFest Toulouse",
    short_name: "DevFest TLS",
    description:
      "La plus grande conférence tech du bassin toulousain, organisée par le GDG Toulouse.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#109E6E",
    icons,
  };
}
