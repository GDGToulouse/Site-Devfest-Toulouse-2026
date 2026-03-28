"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";

interface KeyFigure {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}

const emptyFigure: KeyFigure = { icon: "", value: "", labelFr: "", labelEn: "" };

export default function KeyFiguresPage() {
  const [figures, setFigures] = useState<KeyFigure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetch<KeyFigure[]>("/settings/key-figures").then(({ data }) => {
      if (data) setFigures(data);
      setIsLoading(false);
    });
  }, []);

  function updateFigure(index: number, field: keyof KeyFigure, value: string) {
    setFigures((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function addFigure() {
    setFigures((prev) => [...prev, { ...emptyFigure }]);
  }

  function removeFigure(index: number) {
    setFigures((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    await adminFetch("/settings/key-figures", {
      method: "PUT",
      body: JSON.stringify(figures),
    });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Chiffres cles</h1>
        <button onClick={addFigure} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90">
          Ajouter
        </button>
      </div>

      <div className="space-y-4">
        {figures.map((fig, i) => (
          <div key={i} className="bg-blanc rounded-xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-noir">Chiffre {i + 1}</h3>
              <button onClick={() => removeFigure(i)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Icone (Font Awesome)" name={`icon-${i}`} value={fig.icon} onChange={(v) => updateFigure(i, "icon", v)} placeholder="fa-users" />
              <FormField label="Valeur" name={`value-${i}`} value={fig.value} onChange={(v) => updateFigure(i, "value", v)} placeholder="2000+" />
              <FormField label="Label FR" name={`labelFr-${i}`} value={fig.labelFr} onChange={(v) => updateFigure(i, "labelFr", v)} placeholder="Participants" />
              <FormField label="Label EN" name={`labelEn-${i}`} value={fig.labelEn} onChange={(v) => updateFigure(i, "labelEn", v)} placeholder="Attendees" />
            </div>
          </div>
        ))}
      </div>

      {figures.length === 0 && (
        <p className="text-gris py-8 text-center">Aucun chiffre cle. Cliquez sur "Ajouter" pour commencer.</p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
          {isSaving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {saved && <span className="text-sm text-malachite">Sauvegarde !</span>}
      </div>
    </div>
  );
}
