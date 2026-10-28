"use client";

import { useState, useEffect } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

interface BinCount {
  counter: number;
  bin: number;
  count: number;
}

interface BadgeStatus {
  counters: number;
  binsPerCounter: number;
  capacity: number;
  frozenAt: string | null;
  billetwebBadgeFieldId: string | null;
  numbered: number;
  shortfall: { capacity: number; missingBins: number; binsPerCounterNeeded: number } | null;
  withoutTier: number;
  withoutNumber: number;
  cancelledAfterFreeze: number;
  isWriting: boolean;
  written: number;
  writeErrors: number;
  bins: BinCount[];
}

// The Billetweb write outlasts a request (#639): it runs on the server and this
// screen reads its progress.
const WRITE_POLL_MS = 2000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputClass = "w-24 px-3 py-2 rounded-lg border border-gris/30 text-sm";

// Badge numbering, print file and freeze (#639). Until the freeze, everything
// here is a preview: the numbers are only stored when the badges go to print.
export default function BadgesSection({ editionId, syncedAt }: { editionId: number; syncedAt: string | null }) {
  const [status, setStatus] = useState<BadgeStatus | null>(null);
  const [counters, setCounters] = useState("4");
  const [binsPerCounter, setBinsPerCounter] = useState("3");
  const [fieldId, setFieldId] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState<SaveState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function loadStatus() {
    const { data } = await adminFetch<BadgeStatus>(`/badges/${editionId}`);
    if (!data) return;
    setStatus(data);
    setCounters(String(data.counters));
    setBinsPerCounter(String(data.binsPerCounter));
    setFieldId(data.billetwebBadgeFieldId ?? "");
  }

  // Reloaded after each attendee import: it changes what there is to number.
  useEffect(() => {
    loadStatus();
  }, [editionId, syncedAt]);

  useEffect(() => {
    if (!status?.isWriting) return;
    const timer = setTimeout(loadStatus, WRITE_POLL_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsFeedback(null);
    const result = await adminFetch(`/badges/${editionId}/settings`, {
      method: "PUT",
      body: JSON.stringify({
        counters: Number(counters),
        binsPerCounter: Number(binsPerCounter),
        billetwebBadgeFieldId: fieldId.trim() || null,
      }),
    });
    if (result.status === 200) {
      setSettingsFeedback({ kind: "ok", text: "Réglages enregistrés." });
      loadStatus();
    } else {
      setSettingsFeedback({ kind: "error", text: humanError(result, "Les réglages n'ont pas été enregistrés.") });
    }
  }

  // Fetched rather than linked: a refusal (capacity, unknown tier) comes back as
  // a message on this screen instead of raw JSON in a new tab.
  async function handleDownload() {
    setActionError(null);
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/badges/${editionId}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.message || "Le PDF n'a pas pu être généré.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "badges.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Le PDF n'a pas pu être téléchargé : vérifiez la connexion et réessayez.");
    } finally {
      setIsBusy(false);
    }
  }

  async function writeToBilletweb() {
    const result = await adminFetch(`/badges/${editionId}/billetweb`, { method: "POST" });
    if (result.status !== 202) {
      setActionError(humanError(result, "L'écriture des numéros dans Billetweb a échoué. Relancez-la."));
    }
  }

  async function handleFreeze() {
    setIsConfirmOpen(false);
    setActionError(null);
    setIsBusy(true);
    const result = await adminFetch(`/badges/${editionId}/freeze`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
    if (result.status === 201) {
      // The trace in Billetweb follows the freeze at once (RG-ARR-20).
      await writeToBilletweb();
    } else {
      setActionError(humanError(result, "La numérotation n'a pas pu être gelée."));
    }
    await loadStatus();
    setIsBusy(false);
  }

  async function handleRetryWrite() {
    setActionError(null);
    setIsBusy(true);
    await writeToBilletweb();
    await loadStatus();
    setIsBusy(false);
  }

  if (!status) return null;

  const isFrozen = status.frozenAt !== null;
  const isBlocked = status.shortfall !== null || status.withoutTier > 0 || status.numbered === 0;
  const pendingWrite = status.numbered - status.cancelledAfterFreeze - status.written;
  const counterNumbers = Array.from({ length: status.counters }, (_, i) => i + 1);
  const binNumbers = Array.from({ length: status.binsPerCounter }, (_, i) => i);
  const binCount = (counter: number, bin: number) =>
    status.bins.find((b) => b.counter === counter && b.bin === bin)?.count ?? 0;

  return (
    <section className="mt-8 pt-6 border-t border-gris/20">
      <h3 className="text-lg font-bold text-noir mb-2">Badges</h3>
      <p className="text-sm text-gris mb-4">
        {isFrozen
          ? `Envoyés à l'impression le ${formatDateTime(status.frozenAt as string)} : ${status.numbered} badges numérotés. Plus aucun numéro ne bouge.`
          : `Numérotation provisoire : ${status.numbered} badges à numéroter pour ${status.capacity} places. Elle est recalculée à chaque import, jusqu'à l'envoi à l'impression.`}
      </p>

      <form onSubmit={handleSaveSettings} className="flex flex-wrap items-end gap-4 mb-4">
        <label className="text-sm text-gris">
          Guichets
          <input
            type="number"
            min={1}
            max={9}
            value={counters}
            onChange={(e) => setCounters(e.target.value)}
            disabled={isFrozen}
            className={`${inputClass} block mt-1`}
          />
        </label>
        <label className="text-sm text-gris">
          Bacs de 100 par guichet
          <input
            type="number"
            min={1}
            max={10}
            value={binsPerCounter}
            onChange={(e) => setBinsPerCounter(e.target.value)}
            disabled={isFrozen}
            className={`${inputClass} block mt-1`}
          />
        </label>
        <label className="text-sm text-gris">
          Champ Billetweb « Numéro de badge »
          <input
            type="text"
            inputMode="numeric"
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
            placeholder="Trouvé tout seul"
            className="w-40 px-3 py-2 rounded-lg border border-gris/30 text-sm block mt-1"
          />
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-noir hover:bg-blanc-casse"
        >
          Enregistrer
        </button>
      </form>
      <div className="mb-4">
        <SaveFeedback state={settingsFeedback} onDismiss={() => setSettingsFeedback(null)} />
      </div>

      {status.shortfall && (
        <div className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {status.numbered} badges pour {status.shortfall.capacity} places : il manque {status.shortfall.missingBins} bacs.
          Passez à {status.shortfall.binsPerCounterNeeded} bacs par guichet.
        </div>
      )}
      {!isFrozen && status.withoutTier > 0 && (
        <div className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          Numérotation impossible tant que {status.withoutTier} billets n&apos;ont pas de tarif connu.
        </div>
      )}
      {isFrozen && status.withoutNumber > 0 && (
        <div className="p-3 rounded-lg bg-jaune/20 text-noir text-sm mb-4">
          {status.withoutNumber} participants inscrits après l&apos;envoi à l&apos;impression n&apos;ont pas de badge
          imprimé : ils passeront au guichet d&apos;aide.
        </div>
      )}

      {status.bins.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gris/20 mb-4">
          <table className="w-full text-sm">
            <caption className="sr-only">Badges par guichet et par bac</caption>
            <thead>
              <tr className="bg-blanc-casse/60 border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">Guichet</th>
                {binNumbers.map((bin) => (
                  <th key={bin} className="text-right px-4 py-3 font-medium text-gris">
                    Bac {bin}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counterNumbers.map((counter) => (
                <tr key={counter} className="border-b border-gris/10">
                  <td className="px-4 py-3 text-noir">Guichet {counter}</td>
                  {binNumbers.map((bin) => (
                    <td key={bin} className="px-4 py-3 text-right text-noir">
                      {binCount(counter, bin)}
                      <span className="block text-xs text-gris">
                        {counter * 1000 + bin * 100} à {counter * 1000 + bin * 100 + 99}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <div role="alert" className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {actionError}
        </div>
      )}

      {isFrozen && (
        <div role="status" className="text-sm text-noir mb-4">
          {status.isWriting ? "Écriture dans Billetweb en cours" : "Billetweb"} : {status.written} numéros écrits
          {status.writeErrors > 0 && `, ${status.writeErrors} en échec`}
          {pendingWrite > 0 && status.writeErrors === 0 && `, ${pendingWrite} à écrire`}.
          {!status.isWriting && status.writeErrors > 0 && " Relancez l'écriture : seuls les échecs repartent."}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownload}
          disabled={isBusy || (!isFrozen && isBlocked)}
          className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {isFrozen ? "Télécharger le PDF d'impression" : "Télécharger l'aperçu PDF"}
        </button>
        {!isFrozen && (
          <button
            onClick={() => setIsConfirmOpen(true)}
            disabled={isBusy || isBlocked}
            className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
          >
            Envoyer à l&apos;impression
          </button>
        )}
        {isFrozen && pendingWrite > 0 && (
          <button
            onClick={handleRetryWrite}
            disabled={isBusy || status.isWriting}
            className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
          >
            {status.writeErrors > 0 ? "Relancer l'écriture dans Billetweb" : "Écrire les numéros dans Billetweb"}
          </button>
        )}
      </div>
      {isBusy && <p className="text-sm text-gris mt-2">En cours…</p>}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Envoyer les badges à l'impression ?"
        message={`Les ${status.numbered} numéros actuels deviennent définitifs et sont écrits dans Billetweb. Les participants inscrits ensuite n'auront pas de badge imprimé. Cette action ne se défait pas.`}
        confirmLabel="Geler et envoyer"
        variant="danger"
        onConfirm={handleFreeze}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </section>
  );
}
