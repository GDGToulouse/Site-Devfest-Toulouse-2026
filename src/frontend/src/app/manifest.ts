import type { MetadataRoute } from "next";

import { getIdentitySettings } from "@/lib/api";

// Basic web app manifest (#234): enables "Add to Home Screen" on Android and,
// with the layout's theme-color, a branded mobile toolbar. Not a full PWA —
// no service worker, no offline mode.
//
// Icons reuse the admin-configurable favicons (identity_favicon_png_192/512),
// falling back to the bundled logo so the manifest is always valid.
//
// A declared size that does not match the file is worse than no entry at all
// (#432): Chrome refuses the icon and says so on every page. The bundled logo
// is 96×96 and was announced as 192, then again as 512, so both entries were
// refused and "Add to Home Screen" had nothing left to draw. Each entry now
// declares the size of the file it points at — same shape as the favicon list
// in `lib/identity.ts`, which had it right all along.
//
// Which means: with nothing configured, the manifest offers a 96 px icon and
// Chrome may not offer to install. Producing a real 192/512 square icon is
// design work — the bundled asset is a wide black wordmark — and the admin
// favicon fields are where it belongs once it exists.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const identity = await getIdentitySettings();

  const icons: MetadataRoute.Manifest["icons"] = [];
  if (identity.identity_favicon_png_192) {
    icons.push({
      src: identity.identity_favicon_png_192,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    });
  }
  if (identity.identity_favicon_png_512) {
    icons.push({
      src: identity.identity_favicon_png_512,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    });
  }
  if (icons.length === 0) {
    icons.push({
      src: "/images/logo-devfest-96.png",
      sizes: "96x96",
      type: "image/png",
      purpose: "any",
    });
  }

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
