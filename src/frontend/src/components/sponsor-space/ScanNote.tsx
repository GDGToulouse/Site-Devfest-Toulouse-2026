"use client";

import { useId, useState } from "react";

import { SCAN_NOTE_MAX, saveSponsorScanNote, type SponsorScan } from "@/lib/sponsor-api";

// A note on the talk with a scanned contact (#815): one per contact, shared by
// the sponsor's team, the last change kept with its author.

export function formatNoteTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Who changed the note last, and when. */
export function NoteAuthor({ note }: { note: NonNullable<SponsorScan["note"]> }) {
  return (
    <span className="text-xs text-gris">
      Modifiée par {note.updatedBy}, {formatNoteTime(note.updatedAt)}
    </span>
  );
}

export function noteErrorMessage(status: number, message?: string) {
  if (status === 0) return "La note n'a pas pu être enregistrée : vérifiez la connexion et réessayez.";
  if (status === 429) return "Trop de requêtes en une minute : réessayez dans quelques secondes.";
  return message || "La note n'a pas pu être enregistrée. Réessayez.";
}

/** The field itself, its state held by the caller (the scan page saves it before the next badge). */
export function NoteField({
  value,
  onChange,
  onSave,
  isSaving,
  isDirty,
  error,
  savedNote,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  savedNote: SponsorScan["note"];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-noir">
        Note sur l&apos;échange <span className="font-normal text-gris">(facultatif)</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={SCAN_NOTE_MAX}
        rows={3}
        placeholder="Sujet abordé, suite à donner…"
        className="w-full rounded-xl border border-gris/30 bg-blanc px-3 py-2 text-base text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gris">
          {value.length} / {SCAN_NOTE_MAX}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="min-h-11 rounded-[12px] border border-gris/30 bg-blanc px-4 text-sm font-medium text-noir hover:border-bleu disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer la note"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-terre-cuite">
          {error}
        </p>
      ) : (
        savedNote && !isDirty && <NoteAuthor note={savedNote} />
      )}
    </div>
  );
}

/** In the list: the note shown, and a button to add or change it. */
export default function ScanNoteEditor({
  sponsorId,
  scan,
  onSaved,
}: {
  sponsorId: number;
  scan: SponsorScan;
  onSaved: (scan: SponsorScan) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(scan.note?.text ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    const { data, status, message } = await saveSponsorScanNote(sponsorId, scan.id, draft);
    setIsSaving(false);
    if (!data) {
      setError(noteErrorMessage(status, message));
      return;
    }
    setError(null);
    setIsOpen(false);
    onSaved(data.scan);
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-1">
        {scan.note && (
          <>
            <p className="whitespace-pre-line text-sm text-noir">{scan.note.text}</p>
            <NoteAuthor note={scan.note} />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(scan.note?.text ?? "");
            setIsOpen(true);
          }}
          className="self-start text-sm font-medium text-bleu underline"
        >
          {scan.note ? "Modifier la note" : "Ajouter une note"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <NoteField
        value={draft}
        onChange={setDraft}
        onSave={() => void save()}
        isSaving={isSaving}
        isDirty={draft.trim() !== (scan.note?.text ?? "")}
        error={error}
        savedNote={scan.note}
      />
      <button type="button" onClick={() => setIsOpen(false)} className="self-start text-sm text-gris underline">
        Annuler
      </button>
    </div>
  );
}
