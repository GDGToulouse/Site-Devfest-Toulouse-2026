"use client";

import { useState, useEffect } from "react";
import { adminFetch, getAdminSession, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import TypedConfirmDialog from "@/components/admin/TypedConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import { formatBadgeNumber } from "@/lib/arrivals-live";
import BadgeDesignSection, { type BadgeDesign, type TierBadge } from "@/components/admin/arrivals/BadgeDesignSection";

interface BinCount {
  counter: number;
  bin: number;
  count: number;
}

/** One type of the preview file, in page order (two pages each: front, back). */
interface PreviewPage {
  type: string;
  name: string;
  isNumbered: boolean;
}

interface BadgeStatus {
  counters: number;
  binsPerCounter: number;
  badgesPerBin: number;
  design: BadgeDesign;
  tiers: TierBadge[];
  capacity: number;
  frozenAt: string | null;
  billetwebBadgeFieldId: string | null;
  numbered: number;
  shortfall: { capacity: number; missingBins: number; binsPerCounterNeeded: number } | null;
  withoutTier: number;
  withoutNumber: number;
  cancelledAfterFreeze: number;
  isWriting: boolean;
  scanned: number;
  isResetAllowed: boolean;
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
export default function BadgesSection({
  editionId,
  syncedAt,
  onAttendeesReset,
}: {
  editionId: number;
  syncedAt: string | null;
  /** The reset deleted the attendees: the counts above must reload. */
  onAttendeesReset: () => void;
}) {
  const [status, setStatus] = useState<BadgeStatus | null>(null);
  const [counters, setCounters] = useState("4");
  const [binsPerCounter, setBinsPerCounter] = useState("3");
  const [badgesPerBin, setBadgesPerBin] = useState("100");
  const [fieldId, setFieldId] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState<SaveState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResizeConfirmOpen, setIsResizeConfirmOpen] = useState(false);
  const [dialog, setDialog] = useState<"unfreeze" | "reset" | null>(null);
  // The two ways back are for admins; the API checks it too.
  const [isAdmin, setIsAdmin] = useState(false);
  // What the last preview file holds, since a downloaded PDF does not say it (#776).
  const [previewPages, setPreviewPages] = useState<PreviewPage[] | null>(null);
  // Remounts the design form on each load, so it starts from what is stored.
  const [loadCount, setLoadCount] = useState(0);

  async function loadStatus() {
    const { data } = await adminFetch<BadgeStatus>(`/badges/${editionId}`);
    if (!data) return;
    setStatus(data);
    setCounters(String(data.counters));
    setBinsPerCounter(String(data.binsPerCounter));
    setBadgesPerBin(String(data.badgesPerBin));
    setFieldId(data.billetwebBadgeFieldId ?? "");
    setLoadCount((n) => n + 1);
  }

  // Reloaded after each attendee import: it changes what there is to number.
  useEffect(() => {
    loadStatus();
  }, [editionId, syncedAt]);

  useEffect(() => {
    getAdminSession().then((session) => setIsAdmin(session?.role === "ADMIN"));
  }, []);

  useEffect(() => {
    if (!status?.isWriting) return;
    const timer = setTimeout(loadStatus, WRITE_POLL_MS);
    return () => clearTimeout(timer);
  }, [status]);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    // Once the badges are numbered, a new bin size changes what each bin is
    // supposed to hold: confirmed first, as the backend requires.
    if (status?.frozenAt && Number(badgesPerBin) !== status.badgesPerBin) setIsResizeConfirmOpen(true);
    else saveSettings(false);
  }

  async function saveSettings(confirm: boolean) {
    setIsResizeConfirmOpen(false);
    setSettingsFeedback(null);
    const result = await adminFetch(`/badges/${editionId}/settings`, {
      method: "PUT",
      body: JSON.stringify({
        counters: Number(counters),
        binsPerCounter: Number(binsPerCounter),
        badgesPerBin: Number(badgesPerBin),
        billetwebBadgeFieldId: fieldId.trim() || null,
        ...(confirm ? { confirm: true } : {}),
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
  async function handleDownload(kind: "pdf" | "preview") {
    setActionError(null);
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/badges/${editionId}/${kind}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.message || "Le PDF n'a pas pu être généré.");
        return;
      }
      if (kind === "preview") {
        try {
          setPreviewPages(JSON.parse(decodeURIComponent(res.headers.get("X-Badge-Pages") ?? "")));
        } catch {
          // The file is still good: only its legend is missing.
          setPreviewPages(null);
        }
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

  async function handleWayBack(kind: "unfreeze" | "reset") {
    setDialog(null);
    setActionError(null);
    setIsBusy(true);
    const result = await adminFetch(`/badges/${editionId}/${kind}`, {
      method: "POST",
      body: JSON.stringify({ confirm: kind === "unfreeze" ? "ANNULER" : "REINITIALISER" }),
    });
    if (result.status !== 200) {
      setActionError(
        humanError(
          result,
          kind === "unfreeze" ? "Le gel n'a pas pu être annulé." : "L'accueil n'a pas pu être réinitialisé.",
        ),
      );
    } else if (kind === "reset") {
      onAttendeesReset();
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
  // Why the badges cannot be numbered yet, same order as the backend's refusal; shown beside the
  // buttons it greys out, since a button greyed without a word was taken for a bug (#776).
  const blockedReason = status.withoutTier > 0
    ? `${status.withoutTier} billets n'ont pas de tarif connu : importez les tarifs de l'édition, puis les participants.`
    : status.numbered === 0
      ? "Aucun participant à numéroter : importez d'abord les participants."
      : status.shortfall
        ? `${status.numbered} badges pour ${status.shortfall.capacity} places : il manque ${status.shortfall.missingBins} présentoir${status.shortfall.missingBins > 1 ? "s" : ""}. Passez à ${status.shortfall.binsPerCounterNeeded} présentoirs par guichet.`
        : null;
  const isBlocked = blockedReason !== null;
  const pendingWrite = status.numbered - status.cancelledAfterFreeze - status.written;
  const counterNumbers = Array.from({ length: status.counters }, (_, i) => i + 1);
  const binNumbers = Array.from({ length: status.binsPerCounter }, (_, i) => i + 1);
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
          Présentoirs par guichet
          <input
            type="number"
            min={1}
            max={9}
            value={binsPerCounter}
            onChange={(e) => setBinsPerCounter(e.target.value)}
            disabled={isFrozen}
            className={`${inputClass} block mt-1`}
          />
        </label>
        <label className="text-sm text-gris">
          Badges par présentoir
          <input
            type="number"
            min={10}
            max={100}
            value={badgesPerBin}
            onChange={(e) => setBadgesPerBin(e.target.value)}
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

      {isFrozen && status.withoutNumber > 0 && (
        <div className="p-3 rounded-lg bg-jaune/20 text-noir text-sm mb-4">
          {status.withoutNumber} participants inscrits après l&apos;envoi à l&apos;impression n&apos;ont pas de badge
          imprimé : ils passeront au guichet d&apos;aide.
        </div>
      )}

      {status.bins.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gris/20 mb-4">
          <table className="w-full text-sm">
            <caption className="sr-only">Badges par guichet et par présentoir</caption>
            <thead>
              <tr className="bg-blanc-casse/60 border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">Guichet</th>
                {binNumbers.map((bin) => (
                  <th key={bin} className="text-right px-4 py-3 font-medium text-gris">
                    Présentoir {bin}
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
                        {formatBadgeNumber(counter * 1000 + bin * 100 + 1)} à {formatBadgeNumber(counter * 1000 + bin * 100 + status.badgesPerBin)}
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
          onClick={() => handleDownload("preview")}
          disabled={isBusy}
          className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          Aperçu : recto et verso de chaque type
        </button>
        <button
          onClick={() => handleDownload("pdf")}
          disabled={isBusy || (!isFrozen && isBlocked)}
          className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {isFrozen ? "Télécharger le PDF d'impression" : "Télécharger tous les badges (provisoire)"}
        </button>
        {!isFrozen && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={isBusy || isBlocked}
              aria-describedby={isBlocked ? "freeze-blocked-reason" : undefined}
              className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
            >
              Envoyer à l&apos;impression
            </button>
            {blockedReason && (
              <p id="freeze-blocked-reason" className="max-w-xl text-sm text-terre-cuite">
                {blockedReason}
              </p>
            )}
          </div>
        )}
        {isAdmin && isFrozen && (
          <button
            onClick={() => setDialog("unfreeze")}
            disabled={isBusy || status.isWriting || status.scanned > 0}
            title={status.scanned > 0 ? `${status.scanned} badges déjà scannés ou remis : le gel ne s'annule plus` : undefined}
            className="px-4 py-2 rounded-lg border border-terre-cuite/50 text-sm text-terre-cuite hover:bg-terre-cuite/10 disabled:opacity-50"
          >
            Annuler le gel
          </button>
        )}
        {isAdmin && status.isResetAllowed && (
          <button
            onClick={() => setDialog("reset")}
            disabled={isBusy || status.isWriting}
            className="px-4 py-2 rounded-lg border border-terre-cuite/50 text-sm text-terre-cuite hover:bg-terre-cuite/10 disabled:opacity-50"
          >
            Réinitialiser l&apos;accueil (hors production)
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
      {previewPages && (
        <div className="mt-3 text-sm text-noir">
          <p className="text-gris">
            Le dernier aperçu téléchargé compte {previewPages.length * 2} pages, recto puis verso de chaque type :
          </p>
          <ol className="mt-1 list-none space-y-0.5">
            {previewPages.map((page, i) => (
              <li key={page.type}>
                <span className="font-mono tabular-nums">
                  Pages {i * 2 + 1}-{i * 2 + 2}
                </span>{" "}
                : <strong>{page.name}</strong>
                <span className="text-gris">
                  {page.isNumbered ? ", numéroté (exemple fictif)" : ", sans numéro : accueil dédié"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {isFrozen && status.scanned > 0 && (
        <p className="text-sm text-gris mt-2">
          {status.scanned} badges déjà scannés ou remis : les numéros imprimés font foi, le gel ne s&apos;annule plus.
        </p>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Envoyer les badges à l'impression ?"
        message={`Les ${status.numbered} numéros actuels deviennent définitifs et sont écrits dans Billetweb. Les participants inscrits ensuite n'auront pas de badge imprimé. Le gel ne s'annule plus dès le premier badge scanné.`}
        confirmLabel="Geler et envoyer"
        variant="danger"
        onConfirm={handleFreeze}
        onCancel={() => setIsConfirmOpen(false)}
      />
      <TypedConfirmDialog
        isOpen={dialog === "unfreeze"}
        title="Annuler le gel de la numérotation ?"
        message="Les numéros sont effacés ici et dans le champ « Numéro de badge » de Billetweb. Les badges déjà imprimés avec ces numéros ne servent plus : le gel suivant renumérote tout."
        word="ANNULER"
        confirmLabel="Annuler le gel"
        onConfirm={() => handleWayBack("unfreeze")}
        onCancel={() => setDialog(null)}
      />
      <TypedConfirmDialog
        isOpen={dialog === "reset"}
        title="Réinitialiser l'accueil ?"
        message="Les participants importés de l'édition, leurs scans, états de badge, étiquettes et historique sont supprimés, et le gel est annulé : on repart d'un import propre. Cette action ne se défait pas."
        word="REINITIALISER"
        confirmLabel="Tout effacer"
        onConfirm={() => handleWayBack("reset")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        isOpen={isResizeConfirmOpen}
        title="Changer la taille des présentoirs ?"
        message={`Les badges sont déjà numérotés et imprimés pour des présentoirs de ${status.badgesPerBin}. Les numéros ne bougent pas : seuls la capacité affichée et les intercalaires changent. Vérifiez que les présentoirs du lieu correspondent avant de confirmer.`}
        confirmLabel={`Passer à ${badgesPerBin} par présentoir`}
        variant="danger"
        onConfirm={() => saveSettings(true)}
        onCancel={() => setIsResizeConfirmOpen(false)}
      />

      <BadgeDesignSection
        key={loadCount}
        editionId={editionId}
        design={status.design}
        tiers={status.tiers}
        onSaved={loadStatus}
      />
    </section>
  );
}
