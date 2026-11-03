"use client";

import { useEffect, useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";
import { ADJUSTMENT_REASON_OPTIONS, labelOf, type AdjustmentReason } from "@/lib/sponsor-guests";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// A sponsor's places for the edition (RG-INS-10 to RG-INS-12): those of its
// offer, plus adjustments — places bought separately, a gesture, a correction.
// Kept as lines with their author, so the quota explains itself.

interface Book {
  basePlaces: number;
  adjustmentTotal: number;
  quota: number;
  registeredCount: number;
  outOfQuotaCount: number;
  adjustments: {
    id: number;
    quantity: number;
    reason: AdjustmentReason;
    comment: string | null;
    createdAt: string;
    createdBy: { name: string | null; email: string } | null;
  }[];
}

export default function SponsorQuotaPanel({
  sponsorId,
  editionId,
  onChanged,
}: {
  sponsorId: number;
  editionId: number;
  onChanged: () => void;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("PURCHASED");
  const [comment, setComment] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  async function load() {
    const { data } = await adminFetch<Book>(`/sponsors/${sponsorId}/editions/${editionId}/guests`);
    setBook(data);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId, editionId]);

  async function add() {
    const n = Number(quantity);
    if (!Number.isInteger(n) || n === 0) {
      setFeedback({ kind: "error", text: "Indiquez un nombre de places, positif pour en ajouter, négatif pour en retirer." });
      return;
    }
    setIsBusy(true);
    const res = await adminFetch(`/sponsors/${sponsorId}/editions/${editionId}/guest-adjustments`, {
      method: "POST",
      body: JSON.stringify({ quantity: n, reason, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
    });
    setIsBusy(false);
    if (res.status === 201) {
      setQuantity("");
      setComment("");
      setFeedback({ kind: "ok", text: "Places ajustées." });
      void load();
      onChanged();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "L'ajustement a échoué. Réessayez.") });
  }

  async function withdraw(id: number) {
    if (!window.confirm("Retirer cet ajustement ? Le quota sera recalculé.")) return;
    setIsBusy(true);
    const res = await adminFetch(`/sponsor-guest-adjustments/${id}`, { method: "DELETE" });
    setIsBusy(false);
    if (res.status === 204) {
      void load();
      onChanged();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "Le retrait a échoué. Réessayez.") });
  }

  if (!book) return <p className="text-sm text-gris">Chargement…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-noir">
        Quota : <strong>{book.quota}</strong> place{book.quota > 1 ? "s" : ""} ({book.basePlaces} de l&apos;offre
        {book.adjustmentTotal !== 0 && `, ${book.adjustmentTotal > 0 ? "+" : "−"}${Math.abs(book.adjustmentTotal)} d'ajustement`}) ·{" "}
        {book.registeredCount} inscrit{book.registeredCount > 1 ? "s" : ""}
        {book.outOfQuotaCount > 0 && <span className="text-terre-cuite"> · {book.outOfQuotaCount} hors quota</span>}
      </p>

      {book.adjustments.length > 0 && (
        <ul className="space-y-1 text-sm">
          {book.adjustments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 text-noir">
              <span className="font-medium">{a.quantity > 0 ? `+${a.quantity}` : a.quantity}</span>
              <span>{labelOf(ADJUSTMENT_REASON_OPTIONS, a.reason)}</span>
              {a.comment && <span className="text-gris">« {a.comment} »</span>}
              <span className="text-xs text-gris">
                {a.createdBy?.name ?? a.createdBy?.email ?? "?"}, {new Date(a.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <button
                type="button"
                onClick={() => void withdraw(a.id)}
                disabled={isBusy}
                className="text-xs text-terre-cuite hover:underline disabled:opacity-50"
              >
                Retirer<span className="sr-only"> l&apos;ajustement</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-gris">Places (+ ou −)</span>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gris">Motif</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as AdjustmentReason)}
            className="rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
          >
            {ADJUSTMENT_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-gris">Commentaire (facultatif)</span>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            className="w-full rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
          />
        </label>
        <button
          type="button"
          onClick={() => void add()}
          disabled={isBusy}
          className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
        >
          Ajuster
        </button>
      </div>
      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
    </div>
  );
}
