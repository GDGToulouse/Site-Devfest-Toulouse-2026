"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import RichTextEditor from "@/components/admin/RichTextEditor";

interface EditionVenue {
  id: number;
  venueName: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  venueTransports: string | null;
  venueParking: string | null;
  venueDirectionsUrl: string | null;
}

interface VenueTabProps {
  edition: EditionVenue;
  onSaved: () => void;
}

// Edits the fields behind the public "Lieu & infos pratiques" page (#109):
// coordinates for the map, transports/parking as rich text, and an itinerary
// link. Name and address live in the Général tab and are only shown read-only
// here for context.
export default function VenueTab({ edition, onSaved }: VenueTabProps) {
  const [form, setForm] = useState({
    // Coordinates are kept as strings while editing; parsed on save.
    venueLat: edition.venueLat?.toString() ?? "",
    venueLng: edition.venueLng?.toString() ?? "",
    venueTransports: edition.venueTransports ?? "",
    venueParking: edition.venueParking ?? "",
    venueDirectionsUrl: edition.venueDirectionsUrl ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A blank coordinate clears it (null); a filled one must parse to a finite
  // number, otherwise we refuse to save rather than store NaN.
  function parseCoord(raw: string): number | null | "invalid" {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : "invalid";
  }

  async function persist() {
    const lat = parseCoord(form.venueLat);
    const lng = parseCoord(form.venueLng);
    if (lat === "invalid" || lng === "invalid") {
      setError("Latitude et longitude doivent être des nombres (ex. 43.5497).");
      return;
    }
    // The map needs both or neither — one lone coordinate places nothing.
    if ((lat === null) !== (lng === null)) {
      setError("Renseignez la latitude ET la longitude, ou laissez les deux vides.");
      return;
    }

    setIsSaving(true);
    setSaved(false);
    setError(null);

    // Rich-text / URL fields go as "" (not undefined) when cleared so the
    // backend applies its "" → null branch and the key is not dropped (#166).
    const { status } = await adminFetch(`/editions/${edition.id}`, {
      method: "PUT",
      body: JSON.stringify({
        venueLat: lat,
        venueLng: lng,
        venueTransports: form.venueTransports,
        venueParking: form.venueParking,
        venueDirectionsUrl: form.venueDirectionsUrl,
      }),
    });

    setIsSaving(false);
    if (status === 200) {
      setSaved(true);
      onSaved();
    } else {
      setError("Enregistrement impossible.");
    }
  }

  return (
    <div className="space-y-6">
      {(edition.venueName || edition.venueAddress) && (
        <p className="text-sm text-gris">
          Lieu : <span className="font-medium text-noir">{edition.venueName || "—"}</span>
          {edition.venueAddress ? ` — ${edition.venueAddress}` : ""}
          {" "}(modifiable dans l’onglet Général).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Latitude"
          name="venueLat"
          type="number"
          step="any"
          value={form.venueLat}
          onChange={(v) => setForm({ ...form, venueLat: v })}
          placeholder="43.5497"
          helpText="Coordonnée de la carte. Laissez vide pour masquer la carte."
        />
        <FormField
          label="Longitude"
          name="venueLng"
          type="number"
          step="any"
          value={form.venueLng}
          onChange={(v) => setForm({ ...form, venueLng: v })}
          placeholder="1.5119"
        />
      </div>

      <FormField
        label="Lien itinéraire"
        name="venueDirectionsUrl"
        type="url"
        value={form.venueDirectionsUrl}
        onChange={(v) => setForm({ ...form, venueDirectionsUrl: v })}
        placeholder="https://maps.google.com/?q=..."
        helpText="Bouton « Itinéraire » sur la page publique."
      />

      <RichTextEditor
        label="Accès & transports"
        name="venueTransports"
        value={form.venueTransports}
        onChange={(html) => setForm({ ...form, venueTransports: html })}
        placeholder="Métro, tram, bus, gare…"
      />

      <RichTextEditor
        label="Parking"
        name="venueParking"
        value={form.venueParking}
        onChange={(html) => setForm({ ...form, venueParking: html })}
        placeholder="Parkings à proximité, tarifs, covoiturage…"
      />

      {error && (
        <p role="alert" className="text-sm text-terre-cuite">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={persist}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-malachite text-blanc text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-malachite">Enregistré ✓</span>}
      </div>
    </div>
  );
}
