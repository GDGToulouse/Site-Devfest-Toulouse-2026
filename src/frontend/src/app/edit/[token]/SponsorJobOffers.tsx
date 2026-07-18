"use client";

import { useState } from "react";

export interface JobOffer {
  id: number;
  title: string;
  description: string;
  url: string;
}

export interface JobOffersData {
  items: JobOffer[];
  quota: number;
}

interface Labels {
  save: string;
  saving: string;
  jobOffers: string;
  jobOffersHint: string;
  jobOfferTitle: string;
  jobOfferDescription: string;
  jobOfferUrl: string;
  addJobOffer: string;
  removeJobOffer: string;
  jobOfferQuotaReached: string;
  jobOfferSaved: string;
  jobOfferRejected: string;
}

// A draft has no server id yet; it becomes a real offer on first save.
interface Draft {
  key: string;
  title: string;
  description: string;
  url: string;
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

// Sponsor job offers (#251): the sponsor manages the offers we relay, capped by
// its level. "Add" appends an empty draft; the row saves itself (POST for a
// draft, PUT once it has an id), so we never send placeholder values.
export default function SponsorJobOffers({
  token,
  initial,
  t,
}: {
  token: string;
  initial: JobOffersData;
  t: Labels;
}) {
  const [offers, setOffers] = useState<JobOffer[]>(initial.items);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const total = offers.length + drafts.length;
  const atCap = total >= initial.quota;

  // Deterministic key without Date.now()/Math.random (unavailable server-side,
  // but this is client code — still, a simple counter keeps keys stable).
  const [draftSeq, setDraftSeq] = useState(0);
  function addDraft() {
    setDrafts((prev) => [...prev, { key: `draft-${draftSeq}`, title: "", description: "", url: "" }]);
    setDraftSeq((n) => n + 1);
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function onDraftCreated(key: string, created: JobOffer) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setOffers((prev) => [...prev, created]);
  }

  function onSaved(updated: JobOffer) {
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  function onRemoved(id: number) {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-noir">{t.jobOffers}</p>
      <p className="mb-4 text-sm text-gris">
        {t.jobOffersHint} ({total}/{initial.quota})
      </p>

      <div className="space-y-6">
        {offers.map((offer) => (
          <OfferRow
            key={offer.id}
            token={token}
            offer={offer}
            t={t}
            onSaved={onSaved}
            onRemoved={onRemoved}
          />
        ))}
        {drafts.map((draft) => (
          <OfferRow
            key={draft.key}
            token={token}
            draftKey={draft.key}
            t={t}
            onCreated={onDraftCreated}
            onRemoveDraft={removeDraft}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addDraft}
        disabled={atCap}
        className="mt-4 rounded-lg border border-gris/30 bg-blanc px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
        title={atCap ? t.jobOfferQuotaReached : undefined}
      >
        + {t.addJobOffer}
      </button>
      {atCap && <p className="mt-2 text-xs text-gris">{t.jobOfferQuotaReached}</p>}
    </div>
  );
}

// One offer row — an existing offer (has `offer`) or a draft (has `draftKey`).
function OfferRow({
  token,
  offer,
  draftKey,
  t,
  onSaved,
  onRemoved,
  onCreated,
  onRemoveDraft,
}: {
  token: string;
  offer?: JobOffer;
  draftKey?: string;
  t: Labels;
  onSaved?: (o: JobOffer) => void;
  onRemoved?: (id: number) => void;
  onCreated?: (key: string, o: JobOffer) => void;
  onRemoveDraft?: (key: string) => void;
}) {
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [url, setUrl] = useState(offer?.url ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const isDraft = !offer;
    const res = await fetch(
      isDraft ? `/api/edit/${token}/job-offers` : `/api/edit/${token}/job-offers/${offer!.id}`,
      {
        method: isDraft ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, url }),
      },
    );
    setSaving(false);
    if (res.ok) {
      if (isDraft) {
        const created = (await res.json()) as JobOffer;
        onCreated?.(draftKey!, created);
      } else {
        setSaved(true);
        onSaved?.({ id: offer!.id, title, description, url });
      }
      return;
    }
    if (res.status === 409) setError(t.jobOfferQuotaReached);
    else setError(t.jobOfferRejected);
  }

  async function remove() {
    if (!offer) {
      onRemoveDraft?.(draftKey!);
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/edit/${token}/job-offers/${offer.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.status === 204) onRemoved?.(offer.id);
    else setError(t.jobOfferRejected);
  }

  return (
    <div className="rounded-lg border border-gris/15 bg-blanc-casse p-4 sm:p-5">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">{t.jobOfferTitle}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">{t.jobOfferDescription}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">{t.jobOfferUrl}</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={inputClass} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-[12px] bg-malachite px-5 py-2.5 text-sm font-bold text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="text-sm font-medium text-terre-cuite hover:underline disabled:opacity-50"
          >
            {t.removeJobOffer}
          </button>
          {saved && <span className="text-sm font-medium text-malachite">{t.jobOfferSaved}</span>}
          {error && (
            <span role="alert" className="text-sm font-medium text-terre-cuite">
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
