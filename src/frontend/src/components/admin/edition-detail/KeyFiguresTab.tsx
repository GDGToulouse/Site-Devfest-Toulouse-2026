"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";

interface KeyFigureData {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}

const EMPTY_FIGURE: KeyFigureData = { icon: "", value: "", labelFr: "", labelEn: "" };

interface KeyFiguresTabProps {
  editionId: number;
}

export default function KeyFiguresTab({ editionId }: KeyFiguresTabProps) {
  const [figures, setFigures] = useState<KeyFigureData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    adminFetch<KeyFigureData[]>(`/editions/${editionId}/key-figures`).then(({ data }) => {
      setFigures(data || []);
      setIsLoading(false);
    });
  }, [editionId]);

  function updateFigure(index: number, field: keyof KeyFigureData, value: string) {
    setFigures((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function removeFigure(index: number) {
    setFigures((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    await adminFetch(`/editions/${editionId}/key-figures`, {
      method: "PUT",
      body: JSON.stringify(figures),
    });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement...</p>;

  return (
    <div>
      {figures.length === 0 ? (
        <p className="text-gris text-sm mb-4">Aucun chiffre cle pour cette edition.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {figures.map((fig, i) => (
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

      <div className="flex items-center gap-3">
        <button
          onClick={() => setFigures([...figures, { ...EMPTY_FIGURE }])}
          className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
        >
          + Ajouter
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Sauvegarde..." : "Sauvegarder les chiffres"}
        </button>
        {saved && <span className="text-sm text-malachite">Sauvegarde !</span>}
      </div>
    </div>
  );
}
