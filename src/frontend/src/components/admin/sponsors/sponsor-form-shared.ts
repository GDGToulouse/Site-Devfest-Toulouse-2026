// The sponsor sheet's form value, shared by the panels it is split across
// (#393). One object still backs the whole sheet: the tabs reorganise where
// fields are shown, not what a save sends.
//
// The split follows the data model, not the screen. `name`, `websiteUrl`,
// descriptions, socials and `locale` are columns on `Sponsor` — the company,
// every year. Everything below `tierId` lives on `EditionSponsor` and describes
// ONE participation, which is why editing them from the wrong year silently
// rewrote another edition before this change.
export interface SponsorFormValue {
  // --- Identity: the company, all editions ---
  name: string;
  websiteUrl: string;
  descriptionFr: string;
  descriptionEn: string;
  linkedin: string;
  twitter: string;
  bluesky: string;
  locale: "fr" | "en";

  // --- Participation: one edition ---
  tierId: number | null;
  logoUrl: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
  // Private fields (#249) — organizers only, never public. Per-edition too.
  comKitReceived: boolean;
  comKitLogoWebUrl: string;
  comKitLogoPrintUrl: string;
  comKitCharterUrl: string;
  comKitNotes: string;
  platinumPromoIdea: string;
  platinumCoBuildIdea: string;
}

export const emptySponsorForm: SponsorFormValue = {
  name: "",
  websiteUrl: "",
  descriptionFr: "",
  descriptionEn: "",
  linkedin: "",
  twitter: "",
  bluesky: "",
  locale: "fr",
  tierId: null,
  logoUrl: "",
  publicationStatus: "DRAFT",
  comKitReceived: false,
  comKitLogoWebUrl: "",
  comKitLogoPrintUrl: "",
  comKitCharterUrl: "",
  comKitNotes: "",
  platinumPromoIdea: "",
  platinumCoBuildIdea: "",
};

export const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

// Destructive text actions ("Retirer") were 42×20 and 38×16 px — under the
// WCAG 2.2 minimum of 24×24 for a control that deletes something (#393).
export const removeButtonClass =
  "inline-flex min-h-[24px] items-center rounded px-2 py-1 text-sm text-terre-cuite hover:underline focus:outline-none focus:ring-2 focus:ring-terre-cuite/50";
