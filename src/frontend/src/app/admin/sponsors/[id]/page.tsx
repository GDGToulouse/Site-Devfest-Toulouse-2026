"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, AdminSponsorTier } from "@/lib/types";
import SponsorContacts from "@/components/admin/sponsors/SponsorContacts";
import SponsorEditions from "@/components/admin/sponsors/SponsorEditions";
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
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [editionYear, setEditionYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the chosen name belongs to a company already in base (#389).
  const [existingSponsorId, setExistingSponsorId] = useState<number | null>(null);

  // The tier catalogue drives the "Niveau" <select> and the promo-idea gating.
  useEffect(() => {
    adminFetch<AdminSponsorTier[]>("/sponsor-tiers").then(({ data }) => {
      if (!data) return;
      setTiers(data);
      // A brand-new sponsor needs a tier picked up front (tierId is required):
      // default to the most important one (list is sorted by rank desc).
      if (isNew && data[0]) setForm((f) => (f.tierId === null ? { ...f, tierId: data[0].id } : f));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          tierId: data.tierId,
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
    if (!form.name.trim() || !editionId || !form.tierId) return;
    setIsSaving(true);
    setError(null);
    const socialLinks: Record<string, string> = {};
    if (form.linkedin.trim()) socialLinks.linkedin = form.linkedin.trim();
    if (form.twitter.trim()) socialLinks.twitter = form.twitter.trim();
    if (form.bluesky.trim()) socialLinks.bluesky = form.bluesky.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      tierId: form.tierId,
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
      const { data, status, errorBody } = await adminFetch<{ id: number }>("/sponsors", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      // The slug is global since #129, so a taken name means the company is
      // already there — offer to attach it to the chosen edition rather than
      // leaving the editor at a dead end (#389).
      if (status === 409 && typeof errorBody?.id === "number") {
        setExistingSponsorId(errorBody.id);
        setError(null);
        return;
      }
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

  // Attach the existing company to the edition picked above, then open its
  // sheet where the other participations are managed.
  async function attachExisting() {
    if (!existingSponsorId || !editionId || !form.tierId) return;
    setIsSaving(true);
    const { status } = await adminFetch(`/sponsors/${existingSponsorId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId, tierId: form.tierId }),
    });
    setIsSaving(false);
    if (status === 200 || status === 201) {
      router.push(`/admin/sponsors/${existingSponsorId}`);
    } else {
      setError("Échec du rattachement.");
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
          // The form edits the participation of this year; the other years are
          // managed just below (#389).
          <p className="text-sm text-gris">
            Édition en cours d&apos;édition : <span className="font-medium text-noir">{editionYear ?? "—"}</span>
          </p>
        )}

        <SponsorForm
          value={form}
          // Editing the name invalidates the "already exists" notice: it was
          // about the previous one (#389).
          onChange={(next) => {
            if (next.name !== form.name) setExistingSponsorId(null);
            setForm(next);
          }}
          tiers={tiers}
        />

        {!isNew && current && <SponsorEditions sponsorId={current.id} tiers={tiers} />}

        {!isNew && current && <SponsorContacts sponsorId={current.id} />}

        {existingSponsorId !== null && (
          <div className="rounded-lg border border-orange/40 bg-orange/10 p-3 text-sm text-noir">
            <p>
              <span className="font-medium">{form.name.trim()}</span>{" "}
              existe déjà. Une entreprise n&apos;est saisie qu&apos;une fois : rattachez-la à
              l&apos;édition{" "}
              <span className="font-medium">
                {editions.find((e) => e.id === editionId)?.year ?? "sélectionnée"}
              </span>{" "}
              plutôt que de la recréer.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={attachExisting}
                disabled={isSaving}
                className="rounded-lg bg-malachite px-3 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
              >
                Rattacher à cette édition
              </button>
              <button
                type="button"
                onClick={() => router.push(`/admin/sponsors/${existingSponsorId}`)}
                className="text-sm font-medium text-noir hover:underline"
              >
                Ouvrir la fiche existante
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-terre-cuite">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !form.name.trim() || !editionId || !form.tierId}
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
