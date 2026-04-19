/**
 * Brand identity assets (logos + favicons), configured in /admin/settings.
 * All values are URLs (typically /uploads/...). Empty / missing keys mean
 * "fall back to the bundled default in /public/images/".
 */

export interface IdentitySettings {
  identity_logo_main?: string;
  identity_logo_white?: string;
  identity_logo_monochrome?: string;
  identity_logo_square?: string;
  identity_favicon_ico?: string;
  identity_favicon_svg?: string;
  identity_favicon_png_192?: string;
  identity_favicon_png_512?: string;
  identity_apple_touch_icon?: string;
}

// Bundled defaults used when no admin override is set. These match the
// existing files under /public/images/ so the site keeps working out of
// the box and an admin can progressively replace each asset.
const DEFAULTS = {
  logoMain: "/images/logo-devfest-96.png",
  logoWhite: "/images/logo-devfest-white.svg",
  logoMonochrome: "/images/logo-devfest-96.png",
  logoSquare: "/images/logo-devfest-96.png",
  faviconIco: "/favicon.ico",
} as const;

export type LogoVariant = "main" | "white" | "monochrome" | "square";

/**
 * Resolve the URL of the requested logo variant, with sensible fallbacks:
 *   - asked variant -> if missing, fall back to "main" -> if missing,
 *     bundled default
 *   - white falls back to main if not configured (admins might only ship
 *     a single colour version)
 */
export function getLogoUrl(
  identity: IdentitySettings | Record<string, string> | null | undefined,
  variant: LogoVariant = "main",
): string {
  const id = (identity as Record<string, string>) || {};
  const main = id.identity_logo_main || DEFAULTS.logoMain;
  switch (variant) {
    case "white":
      return id.identity_logo_white || main;
    case "monochrome":
      return id.identity_logo_monochrome || main;
    case "square":
      return id.identity_logo_square || main;
    case "main":
    default:
      return main;
  }
}

/**
 * Build the Next.js Metadata.icons object from the identity settings.
 * Used in the locale layout's generateMetadata.
 */
export function buildFaviconMetadata(
  identity: IdentitySettings | Record<string, string> | null | undefined,
): {
  icon: { url: string; type?: string; sizes?: string }[];
  apple?: { url: string; sizes?: string }[];
  shortcut?: { url: string }[];
} {
  const id = (identity as Record<string, string>) || {};
  const icons: { url: string; type?: string; sizes?: string }[] = [];

  if (id.identity_favicon_svg) {
    icons.push({ url: id.identity_favicon_svg, type: "image/svg+xml" });
  }
  if (id.identity_favicon_png_192) {
    icons.push({ url: id.identity_favicon_png_192, type: "image/png", sizes: "192x192" });
  }
  if (id.identity_favicon_png_512) {
    icons.push({ url: id.identity_favicon_png_512, type: "image/png", sizes: "512x512" });
  }
  // Always end with the .ico (configured or bundled) — broadest browser support.
  icons.push({ url: id.identity_favicon_ico || DEFAULTS.faviconIco });

  const result: ReturnType<typeof buildFaviconMetadata> = {
    icon: icons,
    shortcut: [{ url: id.identity_favicon_ico || DEFAULTS.faviconIco }],
  };
  if (id.identity_apple_touch_icon) {
    result.apple = [{ url: id.identity_apple_touch_icon, sizes: "180x180" }];
  }
  return result;
}
