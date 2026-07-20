"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Talk, Category, Speaker } from "@/lib/types";
import TalkForm, { emptyTalkForm, type TalkFormValue } from "@/components/admin/talks/TalkForm";

interface TalkData extends Talk {
  edition?: { id: number; year: number };
}

export default function TalkEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const talkId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<TalkFormValue>(emptyTalkForm);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [editionYear, setEditionYear] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
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
    } else if (talkId) {
      adminFetch<TalkData>(`/talks/${talkId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/admin/talks");
          return;
        }
        setForm({
          title: data.title,
          description: data.description,
          format: data.format,
          level: data.level ?? "",
          language: data.language,
          categoryId: data.categoryId ? String(data.categoryId) : "",
          speakerIds: data.speakerIds,
          publicationStatus: data.publicationStatus,
          isSpeakerEditable: data.isSpeakerEditable,
        });
        setEditionId(data.editionId);
        setEditionYear(data.edition?.year ?? null);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkId, isNew]);

  // Categories and speakers are edition-scoped (for the pickers).
  useEffect(() => {
    if (!editionId) return;
    void Promise.all([
      adminFetch<Category[]>(`/categories?editionId=${editionId}`),
      adminFetch<Speaker[]>(`/speakers?editionId=${editionId}`),
    ]).then(([{ data: c }, { data: s }]) => {
      if (c) setCategories(c);
      if (s) setSpeakers(s);
    });
  }, [editionId]);

  async function handleSave() {
    if (!form.title.trim() || !editionId) return;
    setIsSaving(true);
    setError(null);
    const payload = {
      editionId,
      title: form.title.trim(),
      description: form.description,
      format: form.format,
      level: form.level || null,
      language: form.language,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      speakerIds: form.speakerIds,
      publicationStatus: form.publicationStatus,
      isSpeakerEditable: form.isSpeakerEditable,
    };

    if (isNew) {
      const { data, status } = await adminFetch<{ id: number }>("/talks", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push(`/admin/talks/${data.id}`);
    } else {
      const { status } = await adminFetch(`/talks/${talkId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      if (status >= 400) {
        setError("Échec de l'enregistrement.");
        return;
      }
      router.push("/admin/talks");
    }
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/talks")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouvelle conférence" : "Modifier la conférence"}</h1>
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

        <TalkForm value={form} onChange={setForm} categories={categories} speakers={speakers} />

        {error && <p className="text-sm text-terre-cuite">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !form.title.trim() || !editionId}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => router.push("/admin/talks")}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
