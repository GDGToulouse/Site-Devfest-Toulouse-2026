import type { EditionStatus } from "./types";

// How the back-office names each phase of an edition, in the order an edition
// goes through them. One list for the status picker, the badges and the
// dashboard: four copies used to drift apart each time a status was added.
export const EDITION_STATUSES: { value: EditionStatus; label: string; variant: "green" | "orange" | "gray" }[] = [
  { value: "PREPARATION", label: "Préparation", variant: "gray" },
  { value: "ANNOUNCEMENT", label: "Annonce", variant: "green" },
  { value: "TICKETING", label: "Dernier mois", variant: "green" },
  { value: "SEE_YOU_NEXT_YEAR", label: "À l'année prochaine", variant: "orange" },
];

export function editionStatusInfo(value: string): { label: string; variant: "green" | "orange" | "gray" } {
  return EDITION_STATUSES.find((s) => s.value === value) ?? { label: value, variant: "gray" };
}
