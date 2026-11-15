import type { MetadataRoute } from "next";

import { getIdentitySettings } from "@/lib/api";

// The home-screen icons of the site's manifests (app/manifest.ts, #234, and the
// event-day zone's, #641): the admin-configurable favicons, else the bundled
// logo. Each entry declares the size of the file it points at (#432).
export async function manifestIcons(): Promise<NonNullable<MetadataRoute.Manifest["icons"]>> {
  const identity = await getIdentitySettings();

  const icons: NonNullable<MetadataRoute.Manifest["icons"]> = [];
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
  return icons;
}
