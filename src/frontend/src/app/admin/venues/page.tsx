"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminFetch, humanError } from "@/lib/admin-api";
import LoadingSpinner from "@/components/admin/LoadingSpinner";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { AdminVenue } from "@/lib/types";

// The venues the DevFest has used (#105). A venue is shared between editions,
// so this list is short and slow-moving — no pagination, no filters.
export default function VenuesPage() {
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminVenue | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<AdminVenue[]>("/venues");
    setVenues(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!newName.trim()) return;
    setIsCreating(true);
    setFeedback(null);

    const result = await adminFetch<AdminVenue>("/venues", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim() }),
    });

    setIsCreating(false);
    // A creation answers 201; anything else failed, network included (#428).
    if (result.status !== 201 || !result.data) {
      setFeedback({ kind: "error", text: humanError(result, "Le lieu n'a pas pu être créé.") });
      return;
    }
    setNewName("");
    setFeedback({ kind: "ok", text: `Lieu « ${result.data.name} » créé.` });
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const venue = pendingDelete;
    setPendingDelete(null);

    const result = await adminFetch(`/venues/${venue.id}`, { method: "DELETE" });
    // A DELETE answers 204, not 200 — adminFetch returns it as-is.
    if (result.status !== 204) {
      setFeedback({ kind: "error", text: humanError(result, "Le lieu n'a pas pu être supprimé.") });
      return;
    }
    setFeedback({ kind: "ok", text: `Lieu « ${venue.name} » supprimé.` });
    load();
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-noir">Lieux</h1>
        <p className="text-sm text-gris">
          Un lieu est partagé entre les éditions, avec ses salles. Les sessions du programme
          sont affectées à ces salles.
        </p>
      </div>

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="newVenue" className="block text-sm font-medium text-noir mb-1">
            Nouveau lieu
          </label>
          <input
            id="newVenue"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Diagora"
            className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={isCreating || !newName.trim()}
          className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
        >
          + Ajouter
        </button>
      </div>

      {venues.length === 0 ? (
        <p className="text-sm text-gris">Aucun lieu pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {venues.map((venue) => (
            <li key={venue.id} className="rounded-[12px] bg-blanc shadow-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/venues/${venue.id}`} className="text-base font-medium text-noir underline">
                    {venue.name}
                  </Link>
                  {venue.address && <p className="text-sm text-gris">{venue.address}</p>}
                  <p className="mt-1 text-sm text-gris">
                    {venue.rooms.length} salle{venue.rooms.length > 1 ? "s" : ""}
                    {venue._count ? ` · ${venue._count.editions} édition${venue._count.editions > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(venue)}
                  className="text-sm text-rouge underline"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Supprimer ce lieu ?"
        // The backend refuses while an edition still points here, so this
        // dialog guards the case where nothing does — which is irreversible.
        message={`« ${pendingDelete?.name ?? ""} » et ses salles seront supprimés définitivement.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
