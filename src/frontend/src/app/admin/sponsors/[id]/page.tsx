"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor } from "@/lib/types";
import EditLinkActions from "@/components/admin/EditLinkActions";
import SponsorForm, { emptySponsorForm, type SponsorFormValue } from "@/components/admin/sponsors/SponsorForm";

interface SponsorData extends Sponsor {
  edition?: { id: number; year: number };
}

export default function SponsorEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const sponsorId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<SponsorFormValue>(emptySponsorForm);
  const [current, setCurrent] = useState<SponsorData | null>(null);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [editionYear, setEditionYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
        if (data) {
          setEditions(data);
          const preset = Number(searchParams.get("editionId"));
          const chosen = data.find((e) => e.id === preset) ?? data[0];
          if (chosen) setEditionId(chosen.id);
        }
      });
    } else if (sponsorId) {
      adminFetch<SponsorData>(`/sponsors/${sponsorId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/admin/sponsors");
          return;
        }
        setCurrent(data);
        setForm({
          name: data.name,
          level: data.level,
          logoUrl: data.logoUrl || "",
          websiteUrl: data.websiteUrl || "",
          descriptionFr: data.descriptionFr || "",
          descriptionEn: data.descriptionEn || "",
          linkedin: data.socialLinks?.linkedin || "",
          twitter: data.socialLinks?.twitter || "",
          bluesky: data.socialLinks?.bluesky || "",
          locale: data.locale === "en" ? "en" : "fr",
          publicationStatus: data.publicationStatus,
          comKitReceived: data.comKitReceived ?? false,
          comKitLogoWebUrl: data.comKitLogoWebUrl || "",
          comKitLogoPrintUrl: data.comKitLogoPrintUrl || "",
          comKitCharterUrl: data.comKitCharterUrl || "",
          comKitNotes: data.comKitNotes || "",
          platinumPromoIdea: data.platinumPromoIdea || "",
          platinumCoBuildIdea: data.platinumCoBuildIdea || "",
        });
        setEditionId(data.editionId);
        setEditionYear(data.edition?.year ?? null);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId, isNew]);

  async function handleSave() {
    if (!form.name.trim() || !editionId) return;
    setIsSaving(true);
    setError(null);
    const socialLinks: Record<string, string> = {};
    if (form.linkedin.trim()) socialLinks.linkedin = form.linkedin.trim();
    if (form.twitter.trim()) socialLinks.twitter = form.twitter.trim();
    if (form.bluesky.trim()) socialLinks.bluesky = form.bluesky.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      level: form.level,
      logoUrl: form.logoUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      descriptionFr: form.descriptionFr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      socialLinks,
      locale: form.locale,
      publicationStatus: form.publicationStatus,
      comKitReceived: form.comKitReceived,
      comKitLogoWebUrl: form.comKitLogoWebUrl || undefined,
      comKitLogoPrintUrl: form.comKitLogoPrintUrl || undefined,
      comKitCharterUrl: form.comKitCharterUrl || undefined,
      comKitNotes: form.comKitNotes || undefined,
      platinumPromoIdea: form.platinumPromoIdea || undefined,
      platinumCoBuildIdea: form.platinumCoBuildIdea || undefined,
    };

    if (isNew) {
      const { data, status } = await adminFetch<{ id: number }>("/sponsors", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push(`/admin/sponsors/${data.id}`);
    } else {
      const { status } = await adminFetch(`/sponsors/${sponsorId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400) {
        setError("Échec de l'enregistrement.");
        return;
      }
      router.push("/admin/sponsors");
    }
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/sponsors")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouveau sponsor" : "Modifier le sponsor"}</h1>
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
        {isNew ? (
          <label className="block max-w-[240px]">
            <span className="block text-sm font-medium text-noir mb-1">Édition *</span>
            <select
              value={editionId ?? ""}
              onChange={(e) => setEditionId(Number(e.target.value))}
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              {editions.map((e) => (
                <option key={e.id} value={e.id}>{e.year}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-gris">Édition : <span className="font-medium text-noir">{editionYear ?? "—"}</span></p>
        )}

        <SponsorForm value={form} onChange={setForm} />

        {!isNew && current && (
          <EditLinkActions
            resource="sponsors"
            entityId={current.id}
            initialEmail={current.contactEmail ?? ""}
            initialLocked={current.editLinkLocked}
          />
        )}

        {error && <p className="text-sm text-terre-cuite">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !form.name.trim() || !editionId}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => router.push("/admin/sponsors")}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
