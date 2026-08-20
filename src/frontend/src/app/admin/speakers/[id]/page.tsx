"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker } from "@/lib/types";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import EditLinkActions from "@/components/admin/EditLinkActions";
import SpeakerForm, { emptySpeakerForm, type SpeakerFormValue } from "@/components/admin/speakers/SpeakerForm";
import SpeakerEditionsPanel from "@/components/admin/speakers/SpeakerEditionsPanel";

type SpeakerData = Speaker;

// The create endpoint answers 409 when the name resolves to a person who already
// exists (#351), rather than forking the identity into `ada-lovelace-2`.
interface ExistingSpeaker {
  existingSpeakerId: number;
  existingSpeakerName: string;
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
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Feedback after a save (#394), shown in place instead of redirecting away.
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [duplicate, setDuplicate] = useState<ExistingSpeaker | null>(null);

  // The editions list is needed in both modes now: to pick the first
  // participation on create, and to offer the ones left to attach on edit.
  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      if (!data) return;
      setEditions(data);
      if (isNew) {
        const preset = Number(searchParams.get("editionId"));
        const chosen = data.find((e) => e.id === preset) ?? data[0];
        if (chosen) setEditionId(chosen.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    if (!isNew && speakerId) {
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
        });
        // Kept for the PUT payload, which still names a participation.
        setEditionId(data.editions[0]?.id ?? null);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerId, isNew]);

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
      // On create this is the first participation. On update it only tells the
      // API which participation a status change would apply to — the panel below
      // handles those, so this payload carries identity fields only.
      editionId,
      name: form.name.trim(),
      photoUrl: form.photoUrl || undefined,
      company: form.company || undefined,
      city: form.city || undefined,
      bioFr: form.bioFr || undefined,
      bioEn: form.bioEn || undefined,
      socialLinks,
      locale: form.locale,
    };

    if (isNew) {
      const { data, status } = await adminFetch<{ id: number } & Partial<ExistingSpeaker>>("/speakers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setIsSaving(false);
      // 409 means the person already exists (#351): offer to attach them to this
      // edition instead of creating a duplicate identity.
      if (status === 409 && data?.existingSpeakerId) {
        setDuplicate({
          existingSpeakerId: data.existingSpeakerId,
          existingSpeakerName: data.existingSpeakerName ?? form.name.trim(),
        });
        return;
      }
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push(`/admin/speakers/${data.id}`);
    } else {
      const { status } = await adminFetch(`/speakers/${speakerId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      // Anything but 200 failed, network included: a dropped connection comes
      // back as status 0, which `>= 400` announced as a save (#428).
      if (status !== 200) {
        setSaveState({ kind: "error", text: "Échec de l'enregistrement. Réessayez." });
        return;
      }
      // Stays on the page rather than redirecting (#394): the redirect was the
      // only signal, and it looked exactly like Cancel.
      setSaveState({ kind: "ok", text: "Modifications enregistrées." });
    }
  }

  // Participations are saved on the spot rather than with the identity form:
  // attaching someone to an edition is its own action, not a draft edit.
  async function attachEdition(targetEditionId: number) {
    const { data, status } = await adminFetch<SpeakerData>(`/speakers/${speakerId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId: targetEditionId }),
    });
    if (status >= 400 || !data) {
      setError("Impossible de rattacher cette édition.");
      return;
    }
    setCurrent(data);
  }

  async function detachEdition(targetEditionId: number) {
    const { status } = await adminFetch(`/speakers/${speakerId}/editions/${targetEditionId}`, {
      method: "DELETE",
    });
    if (status !== 204) {
      setError("Impossible de retirer cette édition.");
      return;
    }
    setCurrent((prev) =>
      prev ? { ...prev, editions: prev.editions.filter((e) => e.id !== targetEditionId) } : prev,
    );
  }

  async function updateParticipation(
    targetEditionId: number,
    patch: { publicationStatus?: "DRAFT" | "PUBLISHED"; isFeatured?: boolean; sponsorId?: number | null },
  ) {
    // The attach endpoint upserts, so it doubles as the update for a
    // participation that already exists.
    const { data, status } = await adminFetch<SpeakerData>(`/speakers/${speakerId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId: targetEditionId, ...patch }),
    });
    if (status >= 400 || !data) {
      setError("Impossible de mettre à jour cette édition.");
      return;
    }
    setCurrent(data);
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/speakers")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouveau speaker" : "Modifier le speaker"}</h1>
        {!isNew && current?.editions.some((e) => e.publicationStatus === "PUBLISHED") && (
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
          current && (
            <SpeakerEditionsPanel
              editions={current.editions}
              allEditions={editions}
              onAttach={attachEdition}
              onDetach={detachEdition}
              onUpdate={updateParticipation}
            />
          )
        )}

        {duplicate && (
          <div role="alert" className="rounded-lg bg-jaune/10 px-4 py-3 text-sm text-noir">
            <p className="mb-2">
              <span className="font-medium">{duplicate.existingSpeakerName}</span> existe déjà. Une
              personne n&apos;a qu&apos;une fiche : rattachez-la à cette édition plutôt que de créer
              un doublon.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/admin/speakers/${duplicate.existingSpeakerId}`)}
              className="px-3 py-1.5 text-sm rounded-lg bg-malachite text-blanc hover:bg-malachite/90"
            >
              Ouvrir sa fiche
            </button>
          </div>
        )}

        <SpeakerForm value={form} onChange={setForm} />

        {!isNew && current && (
          <EditLinkActions
            resource="speakers"
            entityId={current.id}
            initialEmail={current.contactEmail ?? ""}
            initialLocked={current.editLinkLocked}
          />
        )}

        {error && <p role="alert" className="text-sm text-terre-cuite">{error}</p>}

        <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />

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
