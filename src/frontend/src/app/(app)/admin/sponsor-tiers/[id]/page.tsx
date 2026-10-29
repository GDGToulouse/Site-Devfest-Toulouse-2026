"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import TrashButton from "@/components/admin/TrashButton";
import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";
import SponsorTierForm, { emptySponsorTierForm, type SponsorTierFormValue } from "@/components/admin/sponsor-tiers/SponsorTierForm";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

export default function SponsorTierEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";
  const tierId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<SponsorTierFormValue>(emptySponsorTierForm);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);

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
    setSaveState(null);

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
      // Onto the new offer's sheet, as every other create (#415).
      router.push(`/admin/sponsor-tiers/${data.id}`);
    } else {
      const { status } = await adminFetch(`/sponsor-tiers/${tierId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      // Anything but 200 failed, network included: a dropped connection comes
      // back as status 0, which `>= 400` announced as a save (#428).
      if (status !== 200) {
        setError("Échec de l'enregistrement.");
        return;
      }
      // Staying on the sheet, like the other editors (#394, #415).
      setSaveState({ kind: "ok", text: "Modifications enregistrées." });
    }
  }

  if (isLoading) return <p className="text-gris">Chargement…</p>;

  const canSave = form.nameFr.trim() && form.nameEn.trim() && (!isNew || form.key.trim());

  // 1152 px rather than 768 (#410): a contact row or a bilingual field had
  // two thirds of the screen empty beside it; a cap still keeps text lines
  // readable on wide screens.
  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/sponsor-tiers")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouvelle offre" : "Modifier l'offre"}</h1>
        {tierId !== null && (
          <TrashButton
            adminOnly
            path={`/sponsor-tiers/${tierId}`}
            listHref="/admin/sponsor-tiers"
            title="Supprimer l'offre"
            message="Elle sortira du catalogue. Vous pourrez la restaurer depuis la corbeille."
          />
        )}
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
        {/* The name, colour and logo scale are frozen on each participation (#375):
            an edit follows on the editions not over yet, never on the archive (#693). */}
        {!isNew && (
          <p className="text-sm text-gris">
            Le nom, la couleur et l&apos;échelle du logo s&apos;appliquent aux sponsors de l&apos;édition en cours et des éditions à venir.
            Les éditions passées gardent l&apos;affichage de leur année.
          </p>
        )}
        <SponsorTierForm value={form} onChange={setForm} isNew={isNew} />

        {error && <p role="alert" aria-live="assertive" className="text-sm text-terre-cuite">{error}</p>}
        <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />

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
