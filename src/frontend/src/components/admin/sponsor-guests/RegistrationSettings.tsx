"use client";

import { useEffect, useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import { formatDeadline } from "@/lib/sponsor-guests";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// Opening and deadline of the sponsors' guest registration (RG-INS-21,
// RG-INS-28). Closed on every new edition: the team decides when sponsors may
// start. Written by an ADMIN, like every other edition setting.

interface EditionRegistration {
  isSponsorGuestRegistrationOpen: boolean;
  sponsorGuestRegistrationOpenedAt: string | null;
  sponsorGuestDeadline: string | null;
  defaultSponsorGuestDeadline: string | null;
}

export default function RegistrationSettings({
  editionId,
  isAdmin,
  onSaved,
}: {
  editionId: number;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState<EditionRegistration | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  async function load() {
    const { data } = await adminFetch<EditionRegistration>(`/editions/${editionId}`);
    if (!data) return;
    setSaved(data);
    setIsOpen(data.isSponsorGuestRegistrationOpen);
    setDeadline(isoToLocalInput(data.sponsorGuestDeadline));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  async function save() {
    setIsSaving(true);
    setFeedback(null);
    const result = await adminFetch(`/editions/${editionId}`, {
      method: "PUT",
      body: JSON.stringify({ isSponsorGuestRegistrationOpen: isOpen, sponsorGuestDeadline: localInputToIso(deadline) }),
    });
    setIsSaving(false);
    if (result.status === 200) {
      setFeedback({ kind: "ok", text: "Réglages enregistrés." });
      void load();
      onSaved();
      return;
    }
    setFeedback({ kind: "error", text: humanError(result, "L'enregistrement a échoué. Réessayez.") });
  }

  if (!saved) return null;
  const effective = saved.sponsorGuestDeadline ?? saved.defaultSponsorGuestDeadline;

  return (
    <section className="space-y-4 rounded-xl bg-blanc-casse/50 p-6">
      <h3 className="text-lg font-bold text-noir">Inscriptions des invités</h3>
      <p className="text-sm text-gris">
        Ouvertes, les inscriptions apparaissent dans l&apos;espace partenaire de chaque sponsor de l&apos;édition, jusqu&apos;à
        l&apos;échéance. Après, seule l&apos;équipe peut ajouter, modifier ou retirer un invité.
      </p>

      <fieldset disabled={!isAdmin} className="space-y-4">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Inscriptions des invités sponsors">
          {[
            { value: false, label: "Fermées" },
            { value: true, label: "Ouvertes aux sponsors" },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                isOpen === option.value ? "border-malachite bg-malachite/10 font-medium text-noir" : "border-gris/30 text-gris"
              }`}
            >
              <input
                type="radio"
                name="sponsor-guest-registration"
                checked={isOpen === option.value}
                onChange={() => setIsOpen(option.value)}
                className="accent-malachite"
              />
              {option.label}
            </label>
          ))}
        </div>

        <label className="block max-w-sm">
          <span className="mb-1 block text-sm font-medium text-noir">Échéance pour les sponsors</span>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <span className="mt-1 block text-xs text-gris">
            {saved.defaultSponsorGuestDeadline
              ? `Vide : le vendredi précédant l'édition, ${formatDeadline(saved.defaultSponsorGuestDeadline)}.`
              : "Vide : pas d'échéance tant que l'édition n'a pas de date de début."}
          </span>
        </label>
      </fieldset>

      {effective && (
        <p className="text-sm text-noir">
          Échéance retenue : <strong>{formatDeadline(effective)}</strong>
          {saved.sponsorGuestDeadline ? "" : " (par défaut)"}
        </p>
      )}

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
        </div>
      ) : (
        <p className="text-xs text-gris">Seul un administrateur ouvre ou ferme les inscriptions.</p>
      )}
    </section>
  );
}
