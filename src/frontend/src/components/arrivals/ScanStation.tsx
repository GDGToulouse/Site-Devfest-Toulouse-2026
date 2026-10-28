"use client";

import { useEffect, useState } from "react";

import CodeScanner from "@/components/arrivals/CodeScanner";
import ScanResultCard, { type ScanResult } from "@/components/arrivals/ScanResultCard";
import { LOAD_CRITICAL, LOAD_WARNING, counterLoads, type LiveState } from "@/lib/arrivals-live";
import { getOfflineTable, scanTicket, searchAttendees, type SearchHit } from "@/lib/arrivals-api";
import { loadOfflineTable, lookupOffline, storeOfflineTable, type OfflineTable } from "@/lib/arrivals-offline";
import { preloadBarcodeReader } from "@/lib/barcode-reader";
import type { StreamStatus } from "@/lib/use-arrivals-stream";

// A typed entry made only of digits is a ticket code; anything else, a name.
const LOOKS_LIKE_CODE = /^\d{6,}$/;

/** Pause after the last keystroke before searching: one request per name, not per letter. */
const SEARCH_DEBOUNCE_MS = 300;

// The Scan station (RG-ARR-30 to RG-ARR-37, #642): read the confirmation or
// find the person by name, say the number and the counter, keep an eye on
// how loaded each counter is. When the backend does not answer, the phone
// answers from its own table (RG-ARR-64).
export default function ScanStation({
  editionId,
  live,
  status,
}: {
  editionId: number;
  live: LiveState | null;
  status: StreamStatus;
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [table, setTable] = useState<OfflineTable | null>(null);

  useEffect(() => {
    setTable(loadOfflineTable(editionId));
    preloadBarcodeReader();
  }, [editionId]);

  // Refreshed on every (re)connection (RG-ARR-64): a ticket bought or
  // cancelled since the last copy is then right too.
  useEffect(() => {
    if (status !== "connected") return;
    getOfflineTable(editionId).then(({ data }) => {
      if (!data) return;
      storeOfflineTable(data);
      setTable(data);
    });
  }, [editionId, status]);

  // Name search, as the volunteer types.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || LOOKS_LIKE_CODE.test(trimmed)) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      searchAttendees(editionId, trimmed).then(({ data, status: code }) => {
        if (data) setHits(data);
        else {
          setHits(null);
          setError(
            code === 0 || code >= 500
              ? "La recherche par nom a besoin du serveur, qui ne répond pas. Envoyez la personne au guichet d'aide."
              : "La recherche n'a pas abouti. Réessayez.",
          );
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [editionId, query]);

  async function scan(target: { code: string } | { attendeeId: number }) {
    setIsCameraOpen(false);
    setError(null);
    setResult(null);
    // Already known to be cut off: answer at once. Asking the backend first
    // costs the whole timeout per person, measured at 4 s behind Next's relay
    // with the backend down, and the queue is standing there.
    if (status === "disconnected" && "code" in target && table) {
      setResult({ source: "offline", answer: await lookupOffline(table, target.code) });
      setQuery("");
      return;
    }
    setIsBusy(true);
    const res = await scanTicket(editionId, target);
    setIsBusy(false);
    if (res.data) {
      setResult({ source: "online", outcome: res.data });
      setQuery("");
      setHits(null);
      return;
    }
    if (res.status === 401) {
      setError("La session a expiré : reconnectez-vous, puis scannez à nouveau.");
      return;
    }
    if (res.status === 0 || res.status >= 500) {
      if ("code" in target && table) {
        setResult({ source: "offline", answer: await lookupOffline(table, target.code) });
        setQuery("");
        return;
      }
      setError(
        "code" in target
          ? "Le serveur ne répond pas et ce téléphone n'a pas de table hors ligne : envoyez la personne au guichet d'aide."
          : "Le serveur ne répond pas : scannez la confirmation, ou envoyez la personne au guichet d'aide.",
      );
      return;
    }
    setError("Le scan n'a pas abouti. Réessayez.");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (LOOKS_LIKE_CODE.test(trimmed)) scan({ code: trimmed });
  }

  return (
    <div className="flex flex-col gap-4">
      {isCameraOpen ? (
        <CodeScanner onRead={(code) => scan({ code })} onClose={() => setIsCameraOpen(false)} />
      ) : (
        <>
          {isBusy && <p className="text-center text-gris">Recherche du billet…</p>}
          {error && (
            <p role="alert" className="rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
              {error}
            </p>
          )}
          {result && <ScanResultCard result={result} />}
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
              setIsCameraOpen(true);
            }}
            className="rounded-2xl bg-malachite px-4 py-5 text-lg font-bold text-blanc hover:bg-malachite/90"
          >
            {result ? "Scanner le suivant" : "Scanner un billet"}
          </button>
        </>
      )}

      {live && (
        <section aria-labelledby="loads-title">
          <h2 id="loads-title" className="mb-2 text-xs font-medium uppercase tracking-wider text-gris">
            Badges en attente par guichet
          </h2>
          <ul className="grid grid-cols-4 gap-2">
            {counterLoads(live).map((load) => {
              const waiting = load.toFetch + load.ready;
              const tone =
                waiting > LOAD_CRITICAL
                  ? "border-rouge text-rouge"
                  : waiting > LOAD_WARNING
                    ? "border-orange text-orange"
                    : "border-gris/30 text-noir";
              return (
                <li key={load.counter} className={`rounded-xl border-2 bg-blanc p-2 text-center ${tone}`}>
                  <span className="block font-mono text-xl font-bold tabular-nums">{waiting}</span>
                  <span className="text-xs text-gris">G{load.counter}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="scan-query" className="text-sm font-medium text-noir">
          Pas de confirmation ? Nom, prénom ou code du billet
        </label>
        <div className="flex gap-2">
          <input
            id="scan-query"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            enterKeyHint="search"
            className="min-w-0 flex-1 rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-noir"
          />
          {LOOKS_LIKE_CODE.test(query.trim()) && (
            <button type="submit" className="rounded-2xl bg-bleu px-4 py-3 font-medium text-blanc">
              Valider
            </button>
          )}
        </div>
      </form>

      {hits && (
        <ul className="flex flex-col gap-2" aria-label="Résultats de la recherche">
          {hits.length === 0 && <li className="text-sm text-gris">Personne à ce nom.</li>}
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => scan({ attendeeId: hit.id })}
                disabled={hit.isCancelled}
                className="w-full rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-left disabled:opacity-60"
              >
                <span className="block font-bold text-noir">
                  {hit.firstName} {hit.lastName}
                </span>
                <span className="block text-sm text-gris">
                  {[
                    hit.company,
                    hit.isCancelled
                      ? "billet annulé"
                      : hit.isDedicated
                        ? "accueil dédié"
                        : hit.badgeNumber
                          ? `badge ${hit.badgeNumber}`
                          : "sans badge imprimé",
                    hit.scannedAt && "déjà scanné",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!table && status !== "connected" && (
        <p className="text-sm text-gris">
          Ce téléphone n&apos;a pas encore sa table hors ligne : elle se charge dès que le serveur répond.
        </p>
      )}
    </div>
  );
}
