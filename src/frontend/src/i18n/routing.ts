import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // No hreflang in the `Link` response header (#468). next-intl derives it from
  // the URL alone, so it announced both locales on talk pages that exist in one
  // (#293), contradicting the HTML — and its x-default named the unprefixed
  // path, where the HTML names /fr. Every page already emits a complete
  // hreflang set from `pageMetadata`, which knows what the page actually is;
  // two signals disagreeing are worth less than the one that is right.
  alternateLinks: false,
});
