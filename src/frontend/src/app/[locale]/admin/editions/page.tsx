"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface EditionData {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
}

interface KeyFigureData {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}

const STATUS_OPTIONS = [
  { value: "PREPARATION", label: "Preparation", variant: "gray" as const },
  { value: "ANNOUNCEMENT", label: "Annonce", variant: "green" as const },
  { value: "SEE_YOU_NEXT_YEAR", label: "A l'annee prochaine", variant: "orange" as const },
];

const EMPTY_FIGURE: KeyFigureData = { icon: "", value: "", labelFr: "", labelEn: "" };

export default function EditionsPage() {
  const [editions, setEditions] = useState<EditionData[]>([]);
  const [editing, setEditing] = useState<EditionData | null>(null);
  const [keyFigures, setKeyFigures] = useState<KeyFigureData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFigures, setIsSavingFigures] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFigures, setExpandedFigures] = useState<number | null>(null);
  const [newYear, setNewYear] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditionData | null>(null);

  async function loadEditions() {
    setIsLoading(true);
    const { data } = await adminFetch<EditionData[]>("/editions");
    if (data) setEditions(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadEditions();
  }, []);

  async function loadKeyFigures(editionId: number) {
    const { data } = await adminFetch<KeyFigureData[]>(`/editions/${editionId}/key-figures`);
    setKeyFigures(data || []);
  }

  function toggleEditing(edition: EditionData) {
    if (editing?.id === edition.id) {
      setEditing(null);
    } else {
      setEditing({ ...edition });
    }
  }

  function toggleFigures(editionId: number) {
    if (expandedFigures === editionId) {
      setExpandedFigures(null);
      setKeyFigures([]);
    } else {
      setExpandedFigures(editionId);
      loadKeyFigures(editionId);
    }
  }

  async function handleSave() {
    if (!editing) return;
    setIsSaving(true);

    await adminFetch(`/editions/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: editing.status,
        startDate: editing.startDate || undefined,
        endDate: editing.endDate || undefined,
        aftermovieUrl: editing.aftermovieUrl || undefined,
        galleryUrl: editing.galleryUrl || undefined,
        archivedSiteUrl: editing.archivedSiteUrl || undefined,
      }),
    });

    setIsSaving(false);
    setEditing(null);
    loadEditions();
  }

  async function handleSaveFigures(editionId: number) {
    setIsSavingFigures(true);
    await adminFetch(`/editions/${editionId}/key-figures`, {
      method: "PUT",
      body: JSON.stringify(keyFigures),
    });
    setIsSavingFigures(false);
  }

  async function handleCreate() {
    const year = Number(newYear);
    if (!year || year < 2016 || year > 2100) {
      setCreateError("Annee invalide");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    const { status } = await adminFetch("/editions", {
      method: "POST",
      body: JSON.stringify({ year }),
    });
    if (status === 409) {
      setCreateError("Une edition pour cette annee existe deja");
    } else {
      setNewYear("");
    }
    setIsCreating(false);
    loadEditions();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { status, data } = await adminFetch<{ error?: string }>(`/editions/${deleteTarget.id}`, { method: "DELETE" });
    if (status === 409) {
      setCreateError(data?.error || "Impossible de supprimer cette edition");
    }
    setDeleteTarget(null);
    loadEditions();
  }

  function updateFigure(index: number, field: keyof KeyFigureData, value: string) {
    setKeyFigures((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function removeFigure(index: number) {
    setKeyFigures((prev) => prev.filter((_, i) => i !== index));
  }

  function getStatusVariant(status: string): "green" | "orange" | "gray" {
    return STATUS_OPTIONS.find((s) => s.value === status)?.variant || "gray";
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Editions</h1>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="Annee"
            className="w-24 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !newYear}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isCreating ? "Creation..." : "Nouvelle edition"}
          </button>
        </div>
      </div>

      {createError && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{createError}</div>
      )}

      <div className="space-y-4">
        {editions.map((edition) => (
          <div key={edition.id} className="bg-blanc rounded-xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-noir">DevFest {edition.year}</h2>
                <StatusBadge status={STATUS_OPTIONS.find((s) => s.value === edition.status)?.label || edition.status} variant={getStatusVariant(edition.status)} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => toggleFigures(edition.id)}
                  className="text-sm text-bleu hover:underline"
                >
                  {expandedFigures === edition.id ? "Masquer chiffres" : "Chiffres cles"}
                </button>
                <button
                  onClick={() => toggleEditing(edition)}
                  className="text-sm text-bleu hover:underline"
                >
                  {editing?.id === edition.id ? "Annuler" : "Modifier"}
                </button>
                <button
                  onClick={() => setDeleteTarget(edition)}
                  className="text-sm text-terre-cuite hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>

            {editing?.id === edition.id && (
              <div className="space-y-4 border-t border-gris/20 pt-4">
                <div>
                  <label className="block text-sm font-medium text-noir mb-1">Statut</label>
                  <select
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                    className="rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Date debut" name="startDate" type="date" value={editing.startDate?.split("T")[0] || ""} onChange={(v) => setEditing({ ...editing, startDate: v })} />
                  <FormField label="Date fin" name="endDate" type="date" value={editing.endDate?.split("T")[0] || ""} onChange={(v) => setEditing({ ...editing, endDate: v })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Aftermovie URL" name="aftermovieUrl" type="url" value={editing.aftermovieUrl || ""} onChange={(v) => setEditing({ ...editing, aftermovieUrl: v })} />
                  <FormField label="Galerie URL" name="galleryUrl" type="url" value={editing.galleryUrl || ""} onChange={(v) => setEditing({ ...editing, galleryUrl: v })} />
                  <FormField label="Site archive URL" name="archivedSiteUrl" type="url" value={editing.archivedSiteUrl || ""} onChange={(v) => setEditing({ ...editing, archivedSiteUrl: v })} />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
                  >
                    {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                </div>
              </div>
            )}

            {expandedFigures === edition.id && (
              <div className="border-t border-gris/20 pt-4 mt-4">
                <h3 className="text-lg font-bold text-noir mb-4">Chiffres cles</h3>

                {keyFigures.length === 0 ? (
                  <p className="text-gris text-sm mb-4">Aucun chiffre cle pour cette edition.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {keyFigures.map((fig, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
                        <FormField label={i === 0 ? "Icone" : ""} name={`icon-${i}`} value={fig.icon} onChange={(v) => updateFigure(i, "icon", v)} placeholder="users" />
                        <FormField label={i === 0 ? "Valeur" : ""} name={`value-${i}`} value={fig.value} onChange={(v) => updateFigure(i, "value", v)} placeholder="3000" />
                        <FormField label={i === 0 ? "Label FR" : ""} name={`labelFr-${i}`} value={fig.labelFr} onChange={(v) => updateFigure(i, "labelFr", v)} placeholder="Participants" />
                        <FormField label={i === 0 ? "Label EN" : ""} name={`labelEn-${i}`} value={fig.labelEn} onChange={(v) => updateFigure(i, "labelEn", v)} placeholder="Attendees" />
                        <button
                          onClick={() => removeFigure(i)}
                          className="text-terre-cuite hover:underline text-sm pb-2"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setKeyFigures([...keyFigures, { ...EMPTY_FIGURE }])}
                    className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
                  >
                    + Ajouter
                  </button>
                  <button
                    onClick={() => handleSaveFigures(edition.id)}
                    disabled={isSavingFigures}
                    className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
                  >
                    {isSavingFigures ? "Sauvegarde..." : "Sauvegarder les chiffres"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'edition"
        message={`Supprimer l'edition DevFest ${deleteTarget?.year} ? Les chiffres cles et tarifs associes seront aussi supprimes. Les articles lies ne seront pas supprimes.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
