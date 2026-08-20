"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import LoadingSpinner from "@/components/admin/LoadingSpinner";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { ScheduleEntry } from "@/lib/types";

interface ScheduleTabProps {
  editionId: number;
  venueId: number | null;
}

const KIND_LABELS: Record<ScheduleEntry["kind"], string> = {
  OTHER: "Autre",
  PLENARY: "Plénière",
  BREAK: "Pause",
  MEAL: "Repas",
  SOCIAL: "Soirée",
};

/** `2026-11-19T09:00:00.000Z` → `2026-11-19T09:00`, what datetime-local wants. */
function toLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

// Everything on the schedule that is not a session (#105): welcome, warm-up,
// breaks, lunch, the party. The sessions themselves are scheduled on their own
// screen, one by one — this tab is only for what surrounds them.
export default function ScheduleTab({ editionId, venueId }: ScheduleTabProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<SaveState>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduleEntry | null>(null);
  const [draft, setDraft] = useState({
    kind: "BREAK" as ScheduleEntry["kind"],
    labelFr: "",
    labelEn: "",
    startsAt: "",
    endsAt: "",
  });

  const load = useCallback(async () => {
    const { data } = await adminFetch<ScheduleEntry[]>(`/schedule-entries?editionId=${editionId}`);
    setEntries(data ?? []);
    setIsLoading(false);
  }, [editionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!draft.labelFr.trim() || !draft.startsAt || !draft.endsAt) return;
    setFeedback(null);

    const { status, error } = await adminFetch("/schedule-entries", {
      method: "POST",
      body: JSON.stringify({
        editionId,
        kind: draft.kind,
        labelFr: draft.labelFr.trim(),
        // The site is bilingual, so an English label is required. Falling back
        // to the French one is better than an empty cell on /en.
        labelEn: draft.labelEn.trim() || draft.labelFr.trim(),
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
      }),
    });

    if (status !== 201) {
      setFeedback({ kind: "error", text: error ?? "Le moment n'a pas pu être ajouté." });
      return;
    }
    setDraft({ kind: "BREAK", labelFr: "", labelEn: "", startsAt: "", endsAt: "" });
    setFeedback({ kind: "ok", text: "Moment ajouté au programme." });
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const entry = pendingDelete;
    setPendingDelete(null);

    const { status, error } = await adminFetch(`/schedule-entries/${entry.id}`, { method: "DELETE" });
    if (status !== 204) {
      setFeedback({ kind: "error", text: error ?? "Le moment n'a pas pu être supprimé." });
      return;
    }
    setFeedback({ kind: "ok", text: "Moment supprimé." });
    load();
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gris">
          Les moments hors conférence : accueil, pauses, déjeuner, soirée. Les sessions,
          elles, se programment une par une depuis leur fiche.
        </p>
        {venueId === null && (
          <p role="alert" className="mt-2 text-sm text-rouge">
            Aucun lieu n’est rattaché à cette édition : les sessions ne pourront pas être
            affectées à une salle tant que ce n’est pas fait, dans l’onglet Lieu.
          </p>
        )}
      </div>

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      {entries.length === 0 ? (
        <p className="text-sm text-gris">Aucun moment déclaré.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-blanc shadow-card px-4 py-3">
              <span className="text-base text-noir">
                <span className="text-gris">
                  {toLocalInput(entry.startsAt).slice(11)} – {toLocalInput(entry.endsAt).slice(11)}
                </span>{" "}
                {entry.labelFr}
                <span className="text-gris"> · {KIND_LABELS[entry.kind]}</span>
              </span>
              <button type="button" onClick={() => setPendingDelete(entry)} className="text-sm text-rouge underline">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-[12px] border border-gris-clair p-4 space-y-3">
        <p className="text-base font-medium text-noir">Ajouter un moment</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="entryKind" className="block text-sm font-medium text-noir mb-1">Type</label>
            <select
              id="entryKind"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as ScheduleEntry["kind"] })}
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            >
              {(Object.keys(KIND_LABELS) as ScheduleEntry["kind"][]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="entryLabelFr" className="block text-sm font-medium text-noir mb-1">Libellé (FR)</label>
            <input
              id="entryLabelFr"
              value={draft.labelFr}
              onChange={(e) => setDraft({ ...draft, labelFr: e.target.value })}
              placeholder="Pause du matin"
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="entryLabelEn" className="block text-sm font-medium text-noir mb-1">Libellé (EN)</label>
            <input
              id="entryLabelEn"
              value={draft.labelEn}
              onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })}
              placeholder="Morning break"
              className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="entryStart" className="block text-sm font-medium text-noir mb-1">Début</label>
              <input
                id="entryStart"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
              />
            </div>
            <div>
              <label htmlFor="entryEnd" className="block text-sm font-medium text-noir mb-1">Fin</label>
              <input
                id="entryEnd"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                className="w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={!draft.labelFr.trim() || !draft.startsAt || !draft.endsAt}
          className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
        >
          + Ajouter
        </button>
      </div>

      <p className="text-sm text-gris">
        Pour affecter une session à une salle et à un horaire, ouvrez sa fiche depuis{" "}
        <Link href="/admin/talks" className="underline">Conférences</Link>.
      </p>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Supprimer ce moment ?"
        message={`« ${pendingDelete?.labelFr ?? ""} » sera retiré du programme.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
