"use client";

import { useEffect, useRef, useState } from "react";

import { LabelPreview, LabelSheet } from "@/components/arrivals/BadgeLabel";
import CancelScan from "@/components/arrivals/CancelScan";
import CodeScanner from "@/components/arrivals/CodeScanner";
import {
  counterOf,
  formatBadgeNumber,
  type BadgeState,
  type HelpEntry,
  type LiveState,
  type WithdrawalEntry,
} from "@/lib/arrivals-live";
import {
  deliverLabel,
  markWithdrawn,
  printFreeLabel,
  printLabel,
  scanTicket,
  searchAttendees,
  type LabelText,
  type PrintedLabel,
  type ScanOutcome,
  type SearchHit,
} from "@/lib/arrivals-api";
import { LABEL_FORMATS, readLabelFormat, saveLabelFormat, type LabelFormat } from "@/lib/badge-label";

// The help desk (RG-ARR-50 to RG-ARR-54, #713): whoever left the normal path.
// Find the person, see where they stand, and either send them to their
// counter or print them a label for a blank badge. The label prints through
// the Zebra's driver, from the browser's own print dialog.

/** Pause after the last keystroke before searching: one request per name, not per letter. */
const SEARCH_DEBOUNCE_MS = 300;

const STATE_WORDS: Record<BadgeState, string> = {
  PRINTED: "pas encore scanné",
  TO_FETCH: "à chercher",
  READY: "prêt",
  DELIVERED: "distribué",
};

const REFUSALS: Record<string, string> = {
  cancelled: "Ce billet est annulé : pas d'étiquette.",
  dedicated: "Ce billet passe par l'accueil dédié, qui a ses propres badges.",
  not_printed: "Imprimez l'étiquette avant de la remettre.",
};

function failure(status: number, error?: string): string {
  if (error && REFUSALS[error]) return REFUSALS[error];
  if (status === 0 || status >= 500) return "Le serveur ne répond pas : vérifiez la connexion, puis réessayez.";
  if (status === 401) return "La session a expiré : reconnectez-vous, puis réessayez.";
  return "L'opération n'a pas abouti. Réessayez.";
}

function formatTime(iso: string): string {
  const [hours, minutes] = new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit" })
    .split(":");
  return `${hours} h ${minutes}`;
}

/** A ticket from the "to handle" list, seen as a search result: it has no number. */
const fromHelpEntry = (entry: HelpEntry): SearchHit => ({
  id: entry.id,
  firstName: entry.firstName,
  lastName: entry.lastName,
  company: entry.company,
  tierName: entry.tierName,
  badgeNumber: null,
  badgeState: "PRINTED",
  isCancelled: false,
  isDedicated: false,
  scannedAt: entry.scannedAt,
  scannedBy: null,
  labelCount: 0,
  labelDeliveredAt: entry.labelDeliveredAt,
});

const EMPTY_TEXT: LabelText = { firstName: "", lastName: "", company: null };

/** First and last name always; the company too for a label without a ticket. */
function isComplete(text: LabelText, needsCompany: boolean): boolean {
  return text.firstName.trim() !== "" && text.lastName.trim() !== "" && (!needsCompany || (text.company ?? "").trim() !== "");
}

const FIELD_CLASS = "rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-noir";

/** The three lines of a label, typed or corrected at the desk (#801). */
function LabelFields({
  idPrefix,
  text,
  isCompanyRequired,
  onChange,
}: {
  idPrefix: string;
  text: LabelText;
  isCompanyRequired: boolean;
  onChange: (text: LabelText) => void;
}) {
  const fields = [
    { key: "firstName", label: "Prénom", value: text.firstName, isRequired: true },
    { key: "lastName", label: "Nom", value: text.lastName, isRequired: true },
    { key: "company", label: "Entreprise", value: text.company ?? "", isRequired: isCompanyRequired },
  ] as const;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {fields.map((field) => (
        <label key={field.key} htmlFor={`${idPrefix}-${field.key}`} className="flex flex-col gap-1 text-sm text-noir">
          <span>
            {field.label}
            {field.isRequired ? " *" : ""}
          </span>
          <input
            id={`${idPrefix}-${field.key}`}
            value={field.value}
            required={field.isRequired}
            maxLength={100}
            autoComplete="off"
            onChange={(e) =>
              onChange({ ...text, [field.key]: field.key === "company" ? e.target.value || null : e.target.value })
            }
            className={FIELD_CLASS}
          />
        </label>
      ))}
    </div>
  );
}

/** Where a refunded badge is now (#800): in its bin, at its counter, or with the person. */
function whereToFind(entry: WithdrawalEntry): string {
  const counter = counterOf(entry.number);
  if (entry.state === "PRINTED") return `Dans son présentoir, guichet ${counter}`;
  if (entry.state === "DELIVERED") return `Déjà remis à la personne (guichet ${counter})`;
  return `Au guichet ${counter}, ${entry.state === "READY" ? "prêt" : "à chercher"}`;
}

/** Whether the arrival is recorded (#826): a person at the desk may never have met the Scan station. */
function scanStatus(person: SearchHit): string {
  if (!person.scannedAt) return "Pas encore scanné";
  return `Scanné à ${formatTime(person.scannedAt)}${person.scannedBy ? ` par ${person.scannedBy}` : ""}`;
}

/** What a ticket read at the desk did (#826), said at the top of the person's page. */
function scanNotice(outcome: ScanOutcome): string {
  if (outcome.result === "unknown") return "Code inconnu.";
  if (outcome.result === "cancelled") return "Billet annulé : pas de badge ni d'étiquette.";
  const first = outcome.alreadyScanned
    ? `Déjà scanné à ${formatTime(outcome.alreadyScanned.at)}${outcome.alreadyScanned.by ? ` par ${outcome.alreadyScanned.by}` : ""}.`
    : `Billet scanné à ${formatTime(new Date().toISOString())}.`;
  if (outcome.result === "badge" && outcome.badge.state !== "DELIVERED") {
    return `${first} Envoyez la personne au guichet ${counterOf(outcome.badge.number)}, badge ${formatBadgeNumber(outcome.badge.number)}.`;
  }
  return first;
}

/** When and by whom the ticket counts as scanned, after a scan made at the desk. */
function firstScanOf(outcome: ScanOutcome): { scannedAt: string; scannedBy: string | null } {
  if (outcome.result !== "unknown" && outcome.result !== "cancelled" && outcome.alreadyScanned) {
    return { scannedAt: outcome.alreadyScanned.at, scannedBy: outcome.alreadyScanned.by };
  }
  return { scannedAt: new Date().toISOString(), scannedBy: null };
}

function standing(person: SearchHit, state: BadgeState): string {
  if (person.isCancelled) return "Billet annulé";
  if (person.isDedicated) return "Accueil dédié";
  if (person.labelDeliveredAt) return `Étiquette remise à ${formatTime(person.labelDeliveredAt)}`;
  if (person.badgeNumber === null) return "Sans badge imprimé";
  return `Badge ${formatBadgeNumber(person.badgeNumber)}, guichet ${counterOf(person.badgeNumber)} : ${STATE_WORDS[state]}`;
}

export default function HelpStation({
  edition,
  live,
  canCancelScans = false,
}: {
  edition: { id: number; year: number };
  live: LiveState | null;
  /** An admin undoes any scan not yet handed over (#797). */
  canCancelScans?: boolean;
}) {
  const [format, setFormat] = useState<LabelFormat>(LABEL_FORMATS["100x150"]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [person, setPerson] = useState<SearchHit | null>(null);
  // What the label of the person found will print, corrected at the desk (#801).
  const [draft, setDraft] = useState<LabelText>(EMPTY_TEXT);
  // A label for someone without a ticket (#801): open, and what it says.
  const [freeDraft, setFreeDraft] = useState<LabelText | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [label, setLabel] = useState<PrintedLabel | null>(null);
  const [printRequest, setPrintRequest] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The results fold away once someone is picked, so their page comes into view (#826).
  const [isHitsOpen, setIsHitsOpen] = useState(true);
  // Bumped to bring the person's page, and what just happened on it, into view.
  const [revealRequest, setRevealRequest] = useState(0);
  const personTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setFormat(readLabelFormat());
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      searchAttendees(edition.id, trimmed).then(({ data, status, error: code }) => {
        setHits(data);
        if (!data) setError(failure(status, code));
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [edition.id, query]);

  useEffect(() => {
    const title = personTitleRef.current;
    if (revealRequest === 0 || !title) return;
    title.scrollIntoView?.({ behavior: "smooth", block: "start" });
    title.focus({ preventScroll: true });
  }, [revealRequest]);

  const reveal = () => setRevealRequest((n) => n + 1);

  // The sheet must be in the page before the dialog opens.
  useEffect(() => {
    if (printRequest > 0) window.print();
  }, [printRequest]);

  // Oldest first: the first to arrive has waited longest.
  const toHandle = (live?.help ?? []).filter((entry) => !entry.labelDeliveredAt);
  const withdrawals = live?.withdrawals ?? [];

  async function withdraw(entry: WithdrawalEntry) {
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await markWithdrawn(edition.id, entry.id);
    setIsBusy(false);
    if (!data) setError(failure(status, code));
  }
  // The stream knows better than the search that found the person.
  const liveState = person ? (live?.badges.get(person.id)?.state ?? person.badgeState) : "PRINTED";

  function select(next: SearchHit) {
    setPerson(next);
    setDraft({ firstName: next.firstName, lastName: next.lastName, company: next.company });
    setFreeDraft(null);
    setLabel(null);
    setNotice(null);
    setError(null);
    setIsHitsOpen(false);
    reveal();
  }

  async function print() {
    if (!person) return;
    if (!isComplete(draft, false)) {
      setError("Le prénom et le nom de l'étiquette sont obligatoires.");
      reveal();
      return;
    }
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await printLabel(edition.id, person.id, draft);
    setIsBusy(false);
    if (!data) {
      setError(failure(status, code));
      reveal();
      return;
    }
    setLabel(data.label);
    setPerson({ ...person, labelCount: data.printCount });
    setNotice("Étiquette envoyée à l'imprimante. Remettez-la, puis touchez « Étiquette remise ».");
    reveal();
    setPrintRequest((n) => n + 1);
  }

  // No ticket at all: typed here, three lines required, no QR code (#801).
  async function printFree() {
    if (!freeDraft) return;
    if (!isComplete(freeDraft, true)) {
      setError("Prénom, nom et entreprise sont obligatoires pour une étiquette sans billet.");
      return;
    }
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await printFreeLabel(edition.id, freeDraft);
    setIsBusy(false);
    if (!data) {
      setError(failure(status, code));
      return;
    }
    setLabel(data.label);
    setNotice(`Étiquette sans billet imprimée pour ${freeDraft.firstName} ${freeDraft.lastName}.`);
    setPrintRequest((n) => n + 1);
  }

  // A ticket read at the desk counts as a scan, as at the entrance (#801), then
  // opens the person's page.
  async function scanAtDesk(code: string) {
    setIsCameraOpen(false);
    // The previous person's page closes: an unknown code is not theirs.
    setPerson(null);
    setIsBusy(true);
    setError(null);
    setNotice(null);
    const { data, status, error: refusal } = await scanTicket(edition.id, { code });
    if (!data) {
      setIsBusy(false);
      setError(failure(status, refusal));
      return;
    }
    if (data.result === "unknown") {
      setIsBusy(false);
      setError("Code inconnu : cherchez la personne par son nom, ou faites-lui une étiquette sans billet.");
      return;
    }
    const { attendee } = data;
    const found = await searchAttendees(edition.id, `${attendee.firstName} ${attendee.lastName}`);
    setIsBusy(false);
    const hit = found.data?.find((h) => h.id === attendee.id);
    if (!hit) {
      setError(`${scanNotice(data)} Mais la fiche de la personne n'a pas pu s'ouvrir : cherchez-la par son nom.`);
      return;
    }
    select(hit);
    setNotice(scanNotice(data));
  }

  async function deliver() {
    if (!person) return;
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await deliverLabel(edition.id, person.id);
    setIsBusy(false);
    if (!data) {
      setError(failure(status, code));
      reveal();
      return;
    }
    const now = new Date().toISOString();
    setPerson({ ...person, labelDeliveredAt: now, scannedAt: person.scannedAt ?? now });
    setNotice(`Arrivée enregistrée : ${person.firstName} ${person.lastName} a son étiquette.`);
    reveal();
  }

  // A badge waiting in its bin: the person goes to their counter, as if scanned.
  async function sendToCounter() {
    if (!person || person.badgeNumber === null) return;
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await scanTicket(edition.id, { attendeeId: person.id });
    setIsBusy(false);
    if (!data) {
      setError(failure(status, code));
      reveal();
      return;
    }
    setPerson({ ...person, badgeState: "TO_FETCH", ...firstScanOf(data) });
    setNotice(`Envoyez la personne au guichet ${counterOf(person.badgeNumber)}, badge ${formatBadgeNumber(person.badgeNumber)}.`);
    reveal();
  }

  // No badge waiting for them: the arrival is recorded here, label or not (#826).
  async function recordArrival() {
    if (!person) return;
    setIsBusy(true);
    setError(null);
    const { data, status, error: code } = await scanTicket(edition.id, { attendeeId: person.id });
    setIsBusy(false);
    if (!data) {
      setError(failure(status, code));
      reveal();
      return;
    }
    const scanned = firstScanOf(data);
    setPerson({ ...person, ...scanned });
    setNotice(`Arrivée enregistrée à ${formatTime(scanned.scannedAt)}.`);
    reveal();
  }

  const canLabel = person !== null && !person.isCancelled && !person.isDedicated;
  const hasPrinted = person !== null && person.labelCount > 0;
  const isWaitingInBin = person?.badgeNumber != null && liveState === "PRINTED" && !person.labelDeliveredAt;
  const canRecordArrival =
    person !== null && canLabel && person.badgeNumber === null && !person.scannedAt && !person.labelDeliveredAt;

  return (
    <div className="flex flex-col gap-6">
      {withdrawals.length > 0 && (
        <section aria-labelledby="withdrawals-title" className="rounded-3xl border-4 border-rouge bg-blanc p-5 shadow-card">
          <h2 id="withdrawals-title" className="mb-1 flex justify-between text-lg font-bold text-rouge">
            <span>Badges à retirer</span>
            <span className="font-mono tabular-nums">{withdrawals.length}</span>
          </h2>
          <p className="mb-3 text-sm text-gris">Billets remboursés depuis l&apos;impression : allez récupérer ces badges.</p>
          <ul className="flex flex-col gap-2">
            {withdrawals.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-gris/30 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-noir">
                    {formatBadgeNumber(entry.number)} · {entry.firstName} {entry.lastName}
                  </span>
                  <span className="block text-sm text-gris">{whereToFind(entry)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void withdraw(entry)}
                  disabled={isBusy}
                  className="rounded-2xl bg-rouge px-4 py-3 font-bold text-blanc disabled:opacity-60"
                >
                  Badge récupéré
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="to-handle-title" className="rounded-3xl bg-blanc p-5 shadow-card">
        <h2 id="to-handle-title" className="mb-3 flex justify-between text-lg font-bold text-noir">
          <span>À traiter</span>
          <span className="font-mono tabular-nums">{toHandle.length}</span>
        </h2>
        {toHandle.length === 0 ? (
          <p className="text-sm text-gris">Personne n&apos;attend : les billets sans badge scannés dans la file arrivent ici.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {toHandle.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => select(fromHelpEntry(entry))}
                  className={`w-full rounded-2xl border bg-blanc px-4 py-3 text-left hover:border-bleu ${
                    person?.id === entry.id ? "border-terre-cuite" : "border-gris/30"
                  }`}
                >
                  <span className="block font-bold text-noir">
                    {entry.firstName} {entry.lastName}
                  </span>
                  <span className="block text-sm text-gris">
                    {[entry.company, entry.tierName, `scanné à ${formatTime(entry.scannedAt)}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isCameraOpen ? (
        <CodeScanner onRead={(code) => void scanAtDesk(code)} onClose={() => setIsCameraOpen(false)} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsCameraOpen(true);
            }}
            disabled={isBusy}
            className="rounded-2xl bg-malachite px-4 py-4 font-bold text-blanc hover:bg-malachite/90 disabled:opacity-60"
          >
            Scanner un billet
          </button>
          <button
            type="button"
            onClick={() => {
              setPerson(null);
              setLabel(null);
              setNotice(null);
              setError(null);
              setFreeDraft(EMPTY_TEXT);
            }}
            className="rounded-2xl border border-bleu px-4 py-4 font-bold text-bleu"
          >
            Étiquette sans billet
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="help-query" className="text-sm font-medium text-noir">
          Chercher quelqu&apos;un : nom, prénom ou numéro de badge
        </label>
        <input
          id="help-query"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
            setIsHitsOpen(true);
          }}
          autoComplete="off"
          enterKeyHint="search"
          className="rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-noir"
        />
      </div>

      {hits && !isHitsOpen && person && (
        <button type="button" onClick={() => setIsHitsOpen(true)} className="self-start text-sm font-medium text-bleu underline">
          Revenir aux résultats ({hits.length})
        </button>
      )}

      {hits && (isHitsOpen || !person) && (
        <ul className="flex flex-col gap-2" aria-label="Résultats de la recherche">
          {hits.length === 0 && <li className="text-sm text-gris">Personne à ce nom.</li>}
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => select(hit)}
                className={`w-full rounded-2xl border bg-blanc px-4 py-3 text-left hover:border-bleu ${
                  person?.id === hit.id ? "border-terre-cuite" : "border-gris/30"
                }`}
              >
                <span className="block font-bold text-noir">
                  {hit.firstName} {hit.lastName}
                </span>
                <span className="block text-sm text-gris">
                  {[hit.company, standing(hit, live?.badges.get(hit.id)?.state ?? hit.badgeState)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!person && error && (
        <p role="alert" className="rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
          {error}
        </p>
      )}

      {!person && notice && (
        <p role="status" className="rounded-2xl bg-malachite/10 p-3 text-sm text-noir">
          {notice}
        </p>
      )}

      {freeDraft && (
        <section aria-labelledby="free-label-title" className="flex flex-col gap-4 rounded-3xl bg-blanc p-5 shadow-card">
          <div>
            <h2 id="free-label-title" className="text-xl font-bold text-noir">
              Étiquette sans billet
            </h2>
            <p className="text-sm text-gris">
              Pour une personne qui n&apos;a pas de billet : prestataire, invité de dernière minute. Pas de QR code.
            </p>
          </div>
          <LabelFields idPrefix="free-label" text={freeDraft} isCompanyRequired onChange={setFreeDraft} />
          <LabelPreview text={freeDraft} format={format} year={edition.year} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void printFree()}
              disabled={isBusy}
              className="rounded-2xl bg-bleu px-4 py-3 font-bold text-blanc hover:bg-bleu/90 disabled:opacity-60"
            >
              Imprimer l&apos;étiquette sans billet
            </button>
            <button
              type="button"
              onClick={() => setFreeDraft(null)}
              className="rounded-2xl border border-gris/30 px-4 py-3 text-noir"
            >
              Fermer
            </button>
          </div>
        </section>
      )}

      {person && (
        <section aria-labelledby="person-title" className="flex flex-col gap-4 rounded-3xl bg-blanc p-5 shadow-card">
          <div>
            <h2
              id="person-title"
              ref={personTitleRef}
              tabIndex={-1}
              className="scroll-mt-4 text-xl font-bold text-noir focus:outline-none"
            >
              {person.firstName} {person.lastName}
            </h2>
            {person.company && <p className="text-sm text-gris">{person.company}</p>}
          </div>

          {/* What just happened, right under the name the page scrolls to (#826). */}
          {notice && (
            <p role="status" className="rounded-2xl border-2 border-malachite bg-malachite/10 p-4 font-medium text-noir">
              ✓ {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl border-2 border-rouge bg-rouge/10 p-4 text-noir">
              {error}
            </p>
          )}

          <div>
            <p className="font-medium text-noir">{standing(person, liveState)}</p>
            {!person.isCancelled && <p className="text-sm text-gris">{scanStatus(person)}</p>}
          </div>

          {canRecordArrival && (
            <button
              type="button"
              onClick={() => void recordArrival()}
              disabled={isBusy}
              className="rounded-2xl bg-malachite px-4 py-4 font-bold text-blanc hover:bg-malachite/90 disabled:opacity-60"
            >
              Enregistrer l&apos;arrivée
            </button>
          )}

          {isWaitingInBin && (
            <button
              type="button"
              onClick={sendToCounter}
              disabled={isBusy}
              className="rounded-2xl bg-malachite px-4 py-4 font-bold text-blanc hover:bg-malachite/90 disabled:opacity-60"
            >
              Envoyer au guichet {counterOf(person.badgeNumber!)}
            </button>
          )}

          {canCancelScans && person.scannedAt && liveState !== "DELIVERED" && !person.labelDeliveredAt && (
            <CancelScan
              key={person.id}
              editionId={edition.id}
              attendee={person}
              scannedAt={null}
              isAdmin
              onCancelled={(message) => {
                setPerson({ ...person, scannedAt: null, scannedBy: null, badgeState: "PRINTED" });
                setNotice(message);
                reveal();
              }}
            />
          )}

          {canLabel && (
            <div className="flex flex-col gap-3">
              {person.badgeNumber !== null && !person.labelDeliveredAt && (
                <p className="text-sm text-gris">Badge introuvable dans son présentoir ? Imprimez une étiquette.</p>
              )}
              <LabelFields idPrefix="person-label" text={draft} isCompanyRequired={false} onChange={setDraft} />
              {/* The QR code comes back with the first print; until then, the text alone. */}
              <LabelPreview text={{ ...draft, qrSvg: label?.qrSvg }} format={format} year={edition.year} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={print}
                  disabled={isBusy}
                  className="rounded-2xl bg-bleu px-4 py-3 font-bold text-blanc hover:bg-bleu/90 disabled:opacity-60"
                >
                  {hasPrinted ? `Réimprimer (${person.labelCount} déjà)` : "Imprimer l'étiquette"}
                </button>
                {hasPrinted && !person.labelDeliveredAt && (
                  <button
                    type="button"
                    onClick={deliver}
                    disabled={isBusy}
                    className="rounded-2xl bg-malachite px-4 py-3 font-bold text-blanc hover:bg-malachite/90 disabled:opacity-60"
                  >
                    Étiquette remise
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <label className="flex items-center gap-2 text-sm text-gris">
        Rouleau de la Zebra
        <select
          value={format.id}
          onChange={(e) => {
            const next = LABEL_FORMATS[e.target.value as LabelFormat["id"]];
            saveLabelFormat(next.id);
            setFormat(next);
          }}
          className="rounded-xl border border-gris/30 bg-blanc px-2 py-1 text-noir"
        >
          {Object.values(LABEL_FORMATS).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      {label && <LabelSheet text={label} format={format} year={edition.year} />}
    </div>
  );
}
