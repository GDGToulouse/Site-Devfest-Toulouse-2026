"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";

interface CfpData {
  isOpen: boolean;
  sessionizeUrl: string | null;
  openDate: string | null;
  closeDate: string | null;
}

export default function CfpTab() {
  const [cfp, setCfp] = useState<CfpData>({ isOpen: false, sessionizeUrl: null, openDate: null, closeDate: null });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetch<CfpData>("/settings/cfp").then(({ data }) => {
      if (data) setCfp(data);
      setIsLoading(false);
    });
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    await adminFetch("/settings/cfp", {
      method: "PUT",
      body: JSON.stringify(cfp),
    });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement...</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gris bg-blanc-casse/60 rounded-lg px-4 py-3">
        Les parametres du CFP sont globaux et s&apos;appliquent a l&apos;edition active.
      </p>

      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={cfp.isOpen}
            onChange={(e) => setCfp({ ...cfp, isOpen: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gris/30 peer-focus:ring-2 peer-focus:ring-malachite/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-blanc after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-malachite"></div>
        </label>
        <span className="text-sm font-medium text-noir">
          CFP {cfp.isOpen ? "ouvert" : "ferme"}
        </span>
      </div>

      <FormField label="URL Sessionize" name="sessionizeUrl" type="url" value={cfp.sessionizeUrl || ""} onChange={(v) => setCfp({ ...cfp, sessionizeUrl: v || null })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date d'ouverture" name="openDate" type="date" value={cfp.openDate || ""} onChange={(v) => setCfp({ ...cfp, openDate: v || null })} />
        <FormField label="Date de fermeture" name="closeDate" type="date" value={cfp.closeDate || ""} onChange={(v) => setCfp({ ...cfp, closeDate: v || null })} />
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
          {isSaving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {saved && <span className="text-sm text-malachite">Sauvegardé !</span>}
      </div>
    </div>
  );
}
