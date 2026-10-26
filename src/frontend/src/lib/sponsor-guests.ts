import { EVENT_TIME_ZONE } from "@/lib/datetime";

// Sponsor guests (#727 to #733, docs/specs/inscriptions-sponsors.md), shared by
// the partner space and the back-office. The labels are the option labels of
// the Billetweb ticket form (« Sup à 7 ans »): what a sponsor picks is what the
// ticket shows. The backend keeps the same list (lib/sponsor-guest-csv.ts).

export type GuestGender = "FEMALE" | "MALE" | "UNSPECIFIED";
export type GuestExperience = "STUDENT" | "UNDER_3_YEARS" | "FROM_3_TO_7_YEARS" | "OVER_7_YEARS";
export type GuestDiet = "NONE" | "VEGETARIAN" | "VEGAN" | "OTHER";
export type AdjustmentReason = "PURCHASED" | "GOODWILL" | "CORRECTION";

export const GENDER_OPTIONS: { value: GuestGender; label: string }[] = [
  { value: "FEMALE", label: "Femme" },
  { value: "MALE", label: "Homme" },
  { value: "UNSPECIFIED", label: "Non spécifié" },
];

export const EXPERIENCE_OPTIONS: { value: GuestExperience; label: string }[] = [
  { value: "STUDENT", label: "Etudiant" },
  { value: "UNDER_3_YEARS", label: "Inf. à 3 ans" },
  { value: "FROM_3_TO_7_YEARS", label: "Entre 3 et 7 ans" },
  { value: "OVER_7_YEARS", label: "Sup à 7 ans" },
];

export const DIET_OPTIONS: { value: GuestDiet; label: string }[] = [
  { value: "NONE", label: "Pas de régime particulier" },
  { value: "VEGETARIAN", label: "Végétarien" },
  { value: "VEGAN", label: "Végan" },
  { value: "OTHER", label: "Autre (je précise par mail)" },
];

export const ADJUSTMENT_REASON_OPTIONS: { value: AdjustmentReason; label: string }[] = [
  { value: "PURCHASED", label: "Places achetées" },
  { value: "GOODWILL", label: "Geste commercial" },
  { value: "CORRECTION", label: "Correction" },
];

export function labelOf<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export interface GuestDraft {
  lastName: string;
  firstName: string;
  email: string;
  gender: GuestGender | "";
  experience: GuestExperience | "";
  attendsAfterParty: boolean;
  diet: GuestDiet;
  needsAssistance: boolean;
}

export const EMPTY_GUEST: GuestDraft = {
  lastName: "",
  firstName: "",
  email: "",
  gender: "",
  experience: "",
  attendsAfterParty: false,
  diet: "NONE",
  needsAssistance: false,
};

export interface Guest {
  id: number;
  lastName: string;
  firstName: string;
  email: string;
  gender: GuestGender;
  experience: GuestExperience;
  attendsAfterParty: boolean;
  diet: GuestDiet;
  needsAssistance: boolean;
  rank: number;
  isWithinQuota: boolean;
  hasDuplicateEmail: boolean;
}

/** What is missing before a guest can be saved, in the sponsor's words. */
export function guestDraftError(draft: GuestDraft): string | null {
  if (!draft.lastName.trim()) return "Renseignez le nom.";
  if (!draft.firstName.trim()) return "Renseignez le prénom.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return "Renseignez une adresse e-mail valide.";
  if (!draft.gender) return "Choisissez le genre.";
  if (!draft.experience) return "Choisissez l'expérience professionnelle.";
  return null;
}

export function draftOf(guest: Guest): GuestDraft {
  const { lastName, firstName, email, gender, experience, attendsAfterParty, diet, needsAssistance } = guest;
  return { lastName, firstName, email, gender, experience, attendsAfterParty, diet, needsAssistance };
}

/** « vendredi 13 novembre à 23:59 », on the venue's clock whatever the reader's. */
export function formatDeadline(iso: string) {
  // Assembled from parts: the joining word varies between ICU versions
  // (« à », a comma, nothing), which a test pinned on the full string would see.
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} à ${part("hour")}:${part("minute")}`;
}

/** « 18 jours », « 5 heures », « moins d'une heure » until the deadline. */
export function timeLeft(iso: string, now: Date) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `${days} jours`;
  }
  if (hours >= 1) return `${hours} heure${hours > 1 ? "s" : ""}`;
  return "moins d'une heure";
}

/** A file's bytes for the import routes, which take them in base64. */
export async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export interface ImportPreview {
  count: number;
  remaining: number;
  // Sponsor side: lines past the places, which refuse the batch. Admin side:
  // `outOfQuota`, lines that will be imported out of quota.
  excess?: number;
  outOfQuota?: number;
  guests: { line: number; lastName: string; firstName: string; email: string; hasDuplicateEmail: boolean }[];
}

export interface ImportFailure {
  error?: string;
  message?: string;
  lines?: { line: number; message: string }[];
}
