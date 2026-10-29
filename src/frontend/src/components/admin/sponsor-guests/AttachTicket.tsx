"use client";

import { useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";
import {
  EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  labelOf,
  type GuestExperience,
  type GuestGender,
} from "@/lib/sponsor-guests";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// Attaching a ticket created directly in Billetweb to a sponsor, by its number
// (#732, RG-INS-49): the person then counts in the sponsor's places and shows
// in its list, read-only like any guest with a ticket.

interface AttachPreview {
  lastName: string;
  firstName: string;
  email: string;
  gender: GuestGender | null;
  experience: GuestExperience | null;
  ticketId: string;
  ticketRef: string | null;
  tariff: string | null;
}

export default function AttachTicket({
  sponsorId,
  editionId,
  onAttached,
}: {
  sponsorId: number;
  editionId: number;
  onAttached: () => void;
}) {
  const [ticket, setTicket] = useState("");
  const [preview, setPreview] = useState<AttachPreview | null>(null);
  const [gender, setGender] = useState<GuestGender | "">("");
  const [experience, setExperience] = useState<GuestExperience | "">("");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const url = `/sponsors/${sponsorId}/editions/${editionId}/guests/attach`;

  async function look() {
    if (!ticket.trim()) return;
    setIsBusy(true);
    setFeedback(null);
    setPreview(null);
    const res = await adminFetch<AttachPreview>(url, { method: "POST", body: JSON.stringify({ ticket: ticket.trim() }) });
    setIsBusy(false);
    if (res.data) {
      setPreview(res.data);
      setGender(res.data.gender ?? "");
      setExperience(res.data.experience ?? "");
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "Le billet n'a pas pu être lu. Réessayez.") });
  }

  async function attach() {
    setIsBusy(true);
    const res = await adminFetch(url, {
      method: "POST",
      body: JSON.stringify({
        ticket: ticket.trim(),
        confirm: true,
        ...(gender ? { gender } : {}),
        ...(experience ? { experience } : {}),
      }),
    });
    setIsBusy(false);
    if (res.status === 201) {
      setFeedback({ kind: "ok", text: `${preview?.firstName} ${preview?.lastName} est rattaché·e au sponsor.` });
      setPreview(null);
      setTicket("");
      onAttached();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "Le rattachement a échoué. Réessayez.") });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-gris">Numéro du billet (« T356-… » ou identifiant)</span>
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            className="w-64 rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir"
          />
        </label>
        <button
          type="button"
          onClick={() => void look()}
          disabled={isBusy || !ticket.trim()}
          className="rounded-lg border border-gris/30 px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          Rechercher
        </button>
      </div>

      {preview && (
        <div className="space-y-3 rounded-lg border border-gris/20 bg-blanc p-3 text-sm">
          <p className="text-noir">
            <strong>
              {preview.firstName} {preview.lastName}
            </strong>{" "}
            · {preview.email} · {preview.tariff ?? "tarif inconnu"} · billet {preview.ticketRef ?? preview.ticketId}
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-gris">Genre</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as GuestGender)}
                className="rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
              >
                <option value="">À compléter</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gris">Expérience</span>
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value as GuestExperience)}
                className="rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
              >
                <option value="">À compléter</option>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(!preview.gender || !preview.experience) && (
            <p className="text-xs text-gris">
              Le formulaire du billet ne renseigne pas{" "}
              {[!preview.gender && "le genre", !preview.experience && "l'expérience"].filter(Boolean).join(" ni ")} : complétez
              avant de rattacher.
            </p>
          )}
          <button
            type="button"
            onClick={() => void attach()}
            disabled={isBusy || !gender || !experience}
            className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            Rattacher {gender && experience ? `(${labelOf(GENDER_OPTIONS, gender)}, ${labelOf(EXPERIENCE_OPTIONS, experience)})` : ""}
          </button>
        </div>
      )}
      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
    </div>
  );
}
