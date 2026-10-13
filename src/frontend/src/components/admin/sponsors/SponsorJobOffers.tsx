"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import { richTextUsage, tooLongMessage, validationErrorMessage } from "@/lib/sponsor-text-limit";
import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import AuditTrail from "@/components/admin/AuditTrail";
import RichTextLimitMeter from "@/components/sponsor-space/RichTextLimitMeter";
import { inputClass } from "./sponsor-form-shared";

// One participation's job offers, managed by the team (#609). Same fields and
// limits as the sponsor's own tab, so what the team saves is what the sponsor
// could have saved — except the quota, which the team may go past.

interface JobOffer {
  id: number;
  title: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
}

interface Draft {
  title: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
}

const EMPTY: Draft = { title: "", descriptionFr: "", descriptionEn: "", url: "" };

export default function SponsorJobOffers({
  sponsorId,
  editionId,
  year,
  focusOfferId,
}: {
  sponsorId: number;
  editionId: number;
  year: number | null;
  // Opens this offer in the form: the cross-sponsor list links straight to it.
  focusOfferId?: number;
}) {
  const [offers, setOffers] = useState<JobOffer[] | null>(null);
  const [quota, setQuota] = useState(0);
  const [hasParticipation, setHasParticipation] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobOffer | null>(null);

  const load = useCallback(async () => {
    const { data, status } = await adminFetch<{ quota: number; offers: JobOffer[] }>(
      `/sponsors/${sponsorId}/editions/${editionId}/job-offers`,
    );
    if (status === 404) {
      setHasParticipation(false);
      setOffers([]);
      return;
    }
    setHasParticipation(true);
    setOffers(data?.offers ?? []);
    setQuota(data?.quota ?? 0);
    return data?.offers ?? [];
  }, [sponsorId, editionId]);

  useEffect(() => {
    setEditingId(null);
    setDraft(EMPTY);
    setSaveState(null);
    void load().then((loaded) => {
      const focused = loaded?.find((o) => o.id === focusOfferId);
      if (focused) startEdit(focused);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function startEdit(offer: JobOffer) {
    setEditingId(offer.id);
    setDraft({
      title: offer.title,
      descriptionFr: offer.descriptionFr ?? "",
      descriptionEn: offer.descriptionEn ?? "",
      url: offer.url,
    });
    setSaveState(null);
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY);
  }

  async function submit() {
    if (!draft.title.trim()) {
      setSaveState({ kind: "error", text: "Renseignez un intitulé de poste." });
      return;
    }
    if (!draft.url.trim()) {
      setSaveState({ kind: "error", text: "Renseignez le lien vers l'offre." });
      return;
    }
    const tooLong = (["descriptionFr", "descriptionEn"] as const).find(
      (field) => richTextUsage(draft[field]).state === "over",
    );
    if (tooLong) {
      setSaveState({ kind: "error", text: tooLongMessage(tooLong) });
      return;
    }

    setIsBusy(true);
    setSaveState(null);
    const { status, error, errorBody } =
      editingId === null
        ? await adminFetch(`/sponsors/${sponsorId}/editions/${editionId}/job-offers`, {
            method: "POST",
            body: JSON.stringify(draft),
          })
        : await adminFetch(`/job-offers/${editingId}`, { method: "PUT", body: JSON.stringify(draft) });
    setIsBusy(false);

    if (status === 201 || status === 200) {
      setSaveState({ kind: "ok", text: editingId === null ? "Offre publiée." : "Offre mise à jour." });
      resetForm();
      await load();
      return;
    }
    const validation = validationErrorMessage(errorBody?.code as string | undefined, errorBody?.message as string | undefined);
    setSaveState({
      kind: "error",
      text:
        validation ??
        (error === "invalid_url"
          ? "Le lien n'est pas valide. Utilisez une adresse commençant par http:// ou https://."
          : "L'enregistrement a échoué. Réessayez."),
    });
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setIsBusy(true);
    const { status } = await adminFetch(`/job-offers/${target.id}`, { method: "DELETE" });
    setIsBusy(false);
    if (status !== 204) {
      setSaveState({ kind: "error", text: "La suppression a échoué. Réessayez." });
      return;
    }
    if (editingId === target.id) resetForm();
    setSaveState({ kind: "ok", text: "Offre déplacée dans la corbeille." });
    await load();
  }

  if (offers === null) return <p className="text-sm text-gris">Chargement…</p>;

  if (!hasParticipation) {
    return (
      <p className="text-sm text-gris">
        Ce sponsor ne participe pas à l&apos;édition {year ?? "choisie"} : rattachez-le d&apos;abord
        dans l&apos;onglet Participation pour publier ses offres.
      </p>
    );
  }

  const isOverQuota = offers.length > quota;
  // Publishing one more would take a sponsor at its cap past it.
  const willExceedQuota = editingId === null && offers.length >= quota;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gris">
        Le niveau de ce sponsor prévoit {quota} offre{quota > 1 ? "s" : ""}. {offers.length} publiée
        {offers.length > 1 ? "s" : ""}.
      </p>

      {isOverQuota && (
        <p role="status" className="rounded-lg border border-orange/40 bg-orange/10 p-3 text-sm text-noir">
          Quota dépassé ({offers.length} / {quota}). L&apos;équipe peut le dépasser ; le sponsor, lui, ne
          pourra plus publier d&apos;offre depuis son espace tant qu&apos;il n&apos;en retire pas.
        </p>
      )}

      {offers.length > 0 && (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li
              key={o.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                editingId === o.id ? "border-malachite bg-malachite/5" : "border-gris/15 bg-blanc"
              }`}
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium text-noir">{o.title}</p>
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-bleu hover:underline">
                  {o.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => startEdit(o)}
                disabled={isBusy}
                className="rounded px-2 py-1 text-xs font-medium text-noir hover:underline disabled:opacity-50"
              >
                Modifier<span className="sr-only"> l&apos;offre {o.title}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(o)}
                disabled={isBusy}
                className="rounded px-2 py-1 text-xs font-medium text-terre-cuite hover:underline disabled:opacity-50"
              >
                Supprimer<span className="sr-only"> l&apos;offre {o.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-gris/20 p-4">
        <h3 className="mb-3 text-sm font-semibold text-noir">
          {editingId === null ? "Publier une offre" : "Modifier l'offre"}
        </h3>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Intitulé du poste</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Lien vers l&apos;offre</span>
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
              className={inputClass}
            />
          </label>
          <BilingualTabs
            label="Description"
            isEmpty={(lang) => !(lang === "fr" ? draft.descriptionFr : draft.descriptionEn).trim()}
            renderPanel={(lang) => (
              <>
                <RichTextEditor
                  label={lang === "fr" ? "Description (français)" : "Description (English)"}
                  name={`admin-job-offer-description-${lang}`}
                  value={lang === "fr" ? draft.descriptionFr : draft.descriptionEn}
                  onChange={(v) => setDraft((d) => ({ ...d, [lang === "fr" ? "descriptionFr" : "descriptionEn"]: v }))}
                />
                <RichTextLimitMeter html={lang === "fr" ? draft.descriptionFr : draft.descriptionEn} />
              </>
            )}
          />

          <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />

          {willExceedQuota && (
            <p className="text-sm text-noir">
              Cette offre dépassera le quota du niveau ({quota}).
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={isBusy}
              className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              {editingId === null ? "Publier" : "Enregistrer"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSaveState(null);
                }}
                disabled={isBusy}
                className="rounded-lg border border-gris/30 px-4 py-2 text-sm text-gris hover:bg-blanc-casse disabled:opacity-50"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>

      {editingId !== null && <AuditTrail entity="SponsorJobOffer" entityId={editingId} refreshKey={saveState} />}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer l'offre"
        message={`Supprimer « ${deleteTarget?.title} » ? Elle disparaîtra des pages publiques. Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
