"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { adminFetch, humanError } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import RichTextEditor from "@/components/admin/RichTextEditor";
import LoadingSpinner from "@/components/admin/LoadingSpinner";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { AdminVenue, AdminRoom } from "@/lib/types";

// One venue and its rooms (#105). The practical-info fields (#109) moved here
// from the edition: they describe the place, not the year, so two editions at
// the same address can no longer drift apart.
export default function VenueDetailPage() {
  const params = useParams();
  const venueId = Number(params.id);

  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    address: "",
    // Coordinates are kept as strings while editing; parsed on save.
    lat: "",
    lng: "",
    transports: "",
    parking: "",
    directionsUrl: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const [newRoom, setNewRoom] = useState({ name: "", capacity: "", sortOrder: "" });
  const [pendingDelete, setPendingDelete] = useState<AdminRoom | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<AdminVenue>(`/venues/${venueId}`);
    if (data) {
      setVenue(data);
      setForm({
        name: data.name,
        address: data.address ?? "",
        lat: data.lat?.toString() ?? "",
        lng: data.lng?.toString() ?? "",
        transports: data.transports ?? "",
        parking: data.parking ?? "",
        directionsUrl: data.directionsUrl ?? "",
      });
    }
    setIsLoading(false);
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  // A blank coordinate clears it (null); a filled one must parse to a finite
  // number, otherwise we refuse to save rather than store NaN.
  function parseCoord(raw: string): number | null | "invalid" {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : "invalid";
  }

  async function persist() {
    const lat = parseCoord(form.lat);
    const lng = parseCoord(form.lng);
    if (lat === "invalid" || lng === "invalid") {
      setFeedback({ kind: "error", text: "Latitude et longitude doivent être des nombres (ex. 43.5497)." });
      return;
    }
    // The map needs both or neither — one lone coordinate places nothing.
    if ((lat === null) !== (lng === null)) {
      setFeedback({ kind: "error", text: "Renseignez la latitude ET la longitude, ou laissez les deux vides." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    // Rich-text / URL fields go as "" (not undefined) when cleared so the
    // backend applies its "" → null branch and the key is not dropped (#166).
    const result = await adminFetch(`/venues/${venueId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        lat,
        lng,
        transports: form.transports,
        parking: form.parking,
        directionsUrl: form.directionsUrl,
      }),
    });

    setIsSaving(false);
    // Anything but 200 failed, network included: a dropped connection comes
    // back as status 0, which `>= 400` announced as a save (#428).
    if (result.status !== 200) {
      setFeedback({ kind: "error", text: humanError(result, "Le lieu n'a pas pu être enregistré.") });
      return;
    }
    setFeedback({ kind: "ok", text: "Lieu enregistré." });
    load();
  }

  async function addRoom() {
    if (!newRoom.name.trim()) return;
    const result = await adminFetch(`/venues/${venueId}/rooms`, {
      method: "POST",
      body: JSON.stringify({
        name: newRoom.name.trim(),
        capacity: newRoom.capacity.trim() === "" ? null : Number(newRoom.capacity),
        sortOrder: newRoom.sortOrder.trim() === "" ? 0 : Number(newRoom.sortOrder),
      }),
    });
    if (result.status !== 201) {
      setFeedback({ kind: "error", text: humanError(result, "La salle n'a pas pu être créée.") });
      return;
    }
    setNewRoom({ name: "", capacity: "", sortOrder: "" });
    setFeedback({ kind: "ok", text: "Salle ajoutée." });
    load();
  }

  async function confirmDeleteRoom() {
    if (!pendingDelete) return;
    const room = pendingDelete;
    setPendingDelete(null);

    const result = await adminFetch(`/rooms/${room.id}`, { method: "DELETE" });
    if (result.status !== 204) {
      // The backend refuses with a readable reason when sessions are scheduled
      // in the room — surface it rather than a generic failure.
      setFeedback({ kind: "error", text: humanError(result, "La salle n'a pas pu être supprimée.") });
      return;
    }
    setFeedback({ kind: "ok", text: `Salle « ${room.name} » supprimée.` });
    load();
  }

  if (isLoading) return <LoadingSpinner />;
  if (!venue) return <p className="text-sm text-gris">Ce lieu n’existe pas.</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/venues" className="text-sm text-gris underline">
          ← Tous les lieux
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-noir">{venue.name}</h1>
        {venue.editions && venue.editions.length > 0 && (
          <p className="text-sm text-gris">
            Accueille {venue.editions.length > 1 ? "les éditions" : "l’édition"}{" "}
            {venue.editions.map((e) => e.year).join(", ")}.
          </p>
        )}
      </div>

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-noir">Informations pratiques</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nom" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FormField label="Adresse / Ville" name="address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <FormField label="Latitude" name="lat" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
          <FormField label="Longitude" name="lng" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
          <FormField label="Lien itinéraire" name="directionsUrl" value={form.directionsUrl} onChange={(v) => setForm({ ...form, directionsUrl: v })} />
        </div>

        <RichTextEditor
          label="Transports"
          name="transports"
          value={form.transports}
          onChange={(v) => setForm({ ...form, transports: v })}
        />
        <RichTextEditor
          label="Parking"
          name="parking"
          value={form.parking}
          onChange={(v) => setForm({ ...form, parking: v })}
        />

        <button
          type="button"
          onClick={persist}
          disabled={isSaving}
          className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-noir">Salles</h2>
          <p className="text-sm text-gris">
            L’ordre décide de la position des colonnes dans la grille du programme.
          </p>
        </div>

        {venue.rooms.length === 0 ? (
          <p className="text-sm text-gris">Aucune salle — le programme ne pourra pas être établi.</p>
        ) : (
          <ul className="space-y-2">
            {venue.rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-blanc shadow-card px-4 py-3">
                <span className="text-base text-noir">
                  <span className="text-gris">{room.sortOrder}.</span> {room.name}
                  {room.capacity ? <span className="text-gris"> — {room.capacity} places</span> : null}
                </span>
                <button type="button" onClick={() => setPendingDelete(room)} className="text-sm text-rouge underline">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="roomName" className="block text-sm font-medium text-noir mb-1">Nom de la salle</label>
            <input
              id="roomName"
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addRoom()}
              placeholder="Amphithéâtre"
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            />
          </div>
          <div className="w-28">
            <label htmlFor="roomCapacity" className="block text-sm font-medium text-noir mb-1">Places</label>
            <input
              id="roomCapacity"
              inputMode="numeric"
              value={newRoom.capacity}
              onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            />
          </div>
          <div className="w-24">
            <label htmlFor="roomOrder" className="block text-sm font-medium text-noir mb-1">Ordre</label>
            <input
              id="roomOrder"
              inputMode="numeric"
              value={newRoom.sortOrder}
              onChange={(e) => setNewRoom({ ...newRoom, sortOrder: e.target.value })}
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            />
          </div>
          <button
            type="button"
            onClick={addRoom}
            disabled={!newRoom.name.trim()}
            className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
          >
            + Ajouter
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Supprimer cette salle ?"
        message={`« ${pendingDelete?.name ?? ""} » sera supprimée définitivement. Les sessions déjà programmées dedans empêchent la suppression.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDeleteRoom}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
