"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker, Sponsor } from "@/lib/types";
import EditLinkActions from "@/components/admin/EditLinkActions";
import SpeakerForm, { emptySpeakerForm, type SpeakerFormValue } from "@/components/admin/speakers/SpeakerForm";

interface SpeakerData extends Speaker {
  slug: string;
  edition?: { id: number; year: number };
}

export default function SpeakerEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const speakerId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<SpeakerFormValue>(emptySpeakerForm);
  const [current, setCurrent] = useState<SpeakerData | null>(null);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [editionYear, setEditionYear] = useState<number | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
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
    } else if (speakerId) {
      adminFetch<SpeakerData>(`/speakers/${speakerId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/admin/speakers");
          return;
        }
        setCurrent(data);
        setForm({
          name: data.name,
          photoUrl: data.photoUrl || "",
          company: data.company || "",
          city: data.city || "",
          bioFr: data.bioFr || "",
          bioEn: data.bioEn || "",
          linkedin: data.socialLinks?.linkedin || "",
          twitter: data.socialLinks?.twitter || "",
          bluesky: data.socialLinks?.bluesky || "",
          github: data.socialLinks?.github || "",
          website: data.socialLinks?.website || "",
          locale: data.locale === "en" ? "en" : "fr",
          isFeatured: data.isFeatured,
          sponsorId: data.sponsorId ? String(data.sponsorId) : "",
          publicationStatus: data.publicationStatus,
        });
        setEditionId(data.editionId);
        setEditionYear(data.edition?.year ?? null);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerId, isNew]);

  // Sponsor list is edition-scoped (for the "sponsor associé" select).
  useEffect(() => {
    if (!editionId) return;
    adminFetch<Sponsor[]>(`/sponsors?editionId=${editionId}`).then(({ data }) => {
      if (data) setSponsors(data);
    });
  }, [editionId]);

  async function handleSave() {
    if (!form.name.trim() || !editionId) return;
    setIsSaving(true);
    setError(null);
    const socialLinks: Record<string, string> = {};
    if (form.linkedin.trim()) socialLinks.linkedin = form.linkedin.trim();
    if (form.twitter.trim()) socialLinks.twitter = form.twitter.trim();
    if (form.bluesky.trim()) socialLinks.bluesky = form.bluesky.trim();
    if (form.github.trim()) socialLinks.github = form.github.trim();
    if (form.website.trim()) socialLinks.website = form.website.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      photoUrl: form.photoUrl || undefined,
      company: form.company || undefined,
      city: form.city || undefined,
      bioFr: form.bioFr || undefined,
      bioEn: form.bioEn || undefined,
      socialLinks,
      locale: form.locale,
      isFeatured: form.isFeatured,
      sponsorId: form.sponsorId ? Number(form.sponsorId) : null,
      publicationStatus: form.publicationStatus,
    };

    if (isNew) {
      const { data, status } = await adminFetch<{ id: number }>("/speakers", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push(`/admin/speakers/${data.id}`);
    } else {
      const { status } = await adminFetch(`/speakers/${speakerId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400) {
        setError("Échec de l'enregistrement.");
        return;
      }
      router.push("/admin/speakers");
    }
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/speakers")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouveau speaker" : "Modifier le speaker"}</h1>
        {!isNew && current?.publicationStatus === "PUBLISHED" && (
          <a
            href={`/speakers/${current.slug}/social-card`}
            target="_blank"
            rel="noopener"
            className="ml-auto text-sm text-malachite hover:underline"
          >
            Voir le visuel
          </a>
        )}
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

        <SpeakerForm value={form} onChange={setForm} sponsors={sponsors} />

        {!isNew && current && (
          <EditLinkActions
            resource="speakers"
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
            onClick={() => router.push("/admin/speakers")}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
