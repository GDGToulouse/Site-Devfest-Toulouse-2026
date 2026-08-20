import type { SponsorAccessRole } from "@/lib/sponsor-api";

// What each role may do on a sponsor space (#362), in one place: the sponsor's
// own team screen, the invitation page and the back-office all name them, and
// three copies had already started to drift on wording.
//
// Ordered from most to least powerful, like the backend enum.
export const SPONSOR_ROLE_OPTIONS: { value: SponsorAccessRole; label: string; hint: string }[] = [
  { value: "RESPONSABLE", label: "Responsable", hint: "Gère la fiche et invite l'équipe" },
  { value: "EDITEUR", label: "Éditeur", hint: "Gère la fiche" },
  { value: "STAND", label: "Stand", hint: "Consulte la fiche publique" },
];

export const SPONSOR_ROLE_LABELS: Record<SponsorAccessRole, string> = Object.fromEntries(
  SPONSOR_ROLE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SponsorAccessRole, string>;

// Spelled-out form for someone meeting the product for the first time — the
// invitation page explains the role rather than labelling a control.
export function describeSponsorRole(role: SponsorAccessRole): string {
  const option = SPONSOR_ROLE_OPTIONS.find((o) => o.value === role);
  return option ? `${option.label} — ${option.hint.toLowerCase()}` : role;
}
