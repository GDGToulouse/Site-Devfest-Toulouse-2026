"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";
import SponsorTierForm, { emptySponsorTierForm, type SponsorTierFormValue } from "@/components/admin/sponsor-tiers/SponsorTierForm";

export default function SponsorTierEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";
  const tierId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<SponsorTierFormValue>(emptySponsorTierForm);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !tierId) return;
    adminFetch<AdminSponsorTier>(`/sponsor-tiers/${tierId}`).then(({ data, status }) => {
      if (status === 404 || !data) {
        router.push("/admin/sponsor-tiers");
        return;
      }
      setForm({
        key: data.key,
        nameFr: data.nameFr,
        nameEn: data.nameEn,
        subtitleFr: data.subtitleFr || "",
        subtitleEn: data.subtitleEn || "",
        descriptionFr: data.descriptionFr || "",
        descriptionEn: data.descriptionEn || "",
        advantages: data.advantages || [],
        standSize: data.standSize || "",
        color: data.color,
        logoScale: String(data.logoScale),
        rank: String(data.rank),
        jobOfferQuota: String(data.jobOfferQuota),
        allowsPromoIdeas: data.allowsPromoIdeas,
      });
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierId, isNew]);

  async function handleSave() {
    if (!form.nameFr.trim() || !form.nameEn.trim() || (isNew && !form.key.trim())) return;
    setIsSaving(true);
    setError(null);

    // Numeric fields are coerced from their string form state. `key` is only
    // sent on create — it is a locked technical identifier afterwards.
    const payload = {
      ...(isNew && { key: form.key.trim() }),
      nameFr: form.nameFr.trim(),
      nameEn: form.nameEn.trim(),
      subtitleFr: form.subtitleFr || undefined,
      subtitleEn: form.subtitleEn || undefined,
      descriptionFr: form.descriptionFr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      advantages: form.advantages.filter((a) => a.fr.trim() || a.en.trim()),
      standSize: form.standSize || undefined,
      color: form.color,
      logoScale: Number(form.logoScale) || 1,
      rank: Number(form.rank) || 0,
      jobOfferQuota: Number(form.jobOfferQuota) || 1,
      allowsPromoIdeas: form.allowsPromoIdeas,
    };

    if (isNew) {
      const { data, status } = await adminFetch<{ id: number }>("/sponsor-tiers", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status === 409) {
        setError("Cette clé est déjà utilisée par une autre offre.");
        return;
      }
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push("/admin/sponsor-tiers");
    } else {
      const { status } = await adminFetch(`/sponsor-tiers/${tierId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400) {
        setError("Échec de l'enregistrement.");
        return;
      }
      router.push("/admin/sponsor-tiers");
    }
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  const canSave = form.nameFr.trim() && form.nameEn.trim() && (!isNew || form.key.trim());

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/sponsor-tiers")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouvelle offre" : "Modifier l'offre"}</h1>
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
        <SponsorTierForm value={form} onChange={setForm} isNew={isNew} />

        {error && <p role="alert" aria-live="assertive" className="text-sm text-terre-cuite">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => router.push("/admin/sponsor-tiers")}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
