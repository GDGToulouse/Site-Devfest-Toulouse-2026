"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminFetch, humanError } from "@/lib/admin-api";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import type { AdminVenue } from "@/lib/types";

interface EditionVenue {
  id: number;
  venueId: number | null;
  venue: { id: number; name: string; address: string | null } | null;
}

interface VenueTabProps {
  edition: EditionVenue;
  onSaved: () => void;
}

// Picks which venue hosts this edition (#105). The venue's own details — its
// address, its map coordinates, its transports and parking (#109) — are edited
// on the venue screen, because they belong to the place and not to the year.
// Two editions at Diagora describing it differently is exactly what moving
// these fields off the edition was meant to prevent.
export default function VenueTab({ edition, onSaved }: VenueTabProps) {
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [selectedId, setSelectedId] = useState<string>(edition.venueId?.toString() ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const loadVenues = useCallback(async () => {
    const { data } = await adminFetch<AdminVenue[]>("/venues");
    setVenues(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  async function persist() {
    setIsSaving(true);
    setFeedback(null);

    const result = await adminFetch(`/editions/${edition.id}`, {
      method: "PUT",
      body: JSON.stringify({ venueId: selectedId === "" ? null : Number(selectedId) }),
    });

    setIsSaving(false);
    // Anything but 200 failed, network included: a dropped connection comes
    // back as status 0, which `>= 400` announced as a save (#428).
    if (result.status !== 200) {
      setFeedback({ kind: "error", text: humanError(result, "Le lieu n'a pas pu être enregistré.") });
      return;
    }
    setFeedback({ kind: "ok", text: "Lieu enregistré." });
    onSaved();
  }

  const selected = venues.find((v) => v.id.toString() === selectedId) ?? null;
  const isDirty = selectedId !== (edition.venueId?.toString() ?? "");

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="venueId" className="block text-sm font-medium text-noir mb-1">
          Lieu de l’édition
        </label>
        <select
          id="venueId"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isLoading}
          className="w-full max-w-md rounded-[12px] border border-gris-clair px-3 py-2 text-base"
        >
          <option value="">— Aucun lieu —</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
              {venue.address ? ` — ${venue.address}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-gris">
          Un lieu est partagé entre les éditions. Son adresse, sa carte et ses infos pratiques
          se modifient sur <Link href="/admin/venues" className="underline">l’écran des lieux</Link>.
        </p>
      </div>

      {selected && (
        <div className="rounded-[12px] border border-gris-clair p-4">
          <p className="text-sm font-medium text-noir">{selected.name}</p>
          {selected.address && <p className="text-sm text-gris">{selected.address}</p>}
          <p className="mt-2 text-sm text-gris">
            {selected.rooms.length === 0
              ? "Aucune salle déclarée — le programme ne pourra pas être établi."
              : `${selected.rooms.length} salle${selected.rooms.length > 1 ? "s" : ""} : ${selected.rooms.map((r) => r.name).join(", ")}`}
          </p>
          <Link
            href={`/admin/venues/${selected.id}`}
            className="mt-3 inline-block text-sm text-bleu underline"
          >
            Modifier ce lieu et ses salles
          </Link>
        </div>
      )}

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      <button
        type="button"
        onClick={persist}
        disabled={isSaving || !isDirty}
        className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
      >
        {isSaving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
