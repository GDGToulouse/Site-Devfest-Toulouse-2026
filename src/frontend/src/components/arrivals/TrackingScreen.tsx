"use client";

import { useState } from "react";

import ConnectionIndicator from "@/components/arrivals/ConnectionIndicator";
import { LOAD_CRITICAL, LOAD_WARNING } from "@/lib/arrivals-live";
import type { TrackingSummary } from "@/lib/arrivals-api";
import { useEventStream } from "@/lib/use-arrivals-stream";

// The team's tracking screen (RG-ARR-62, #644): one decision to support,
// moving volunteers where the queue grows. Readable across the room on a big
// screen, and on a phone. Totals only: the backend sends no name.

const waitingTone = (waiting: number) =>
  waiting > LOAD_CRITICAL ? "text-rouge" : waiting > LOAD_WARNING ? "text-orange" : "text-noir";

function Figure({ label, value, tone = "text-noir" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-gris/20 bg-blanc px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gris">{label}</p>
      <p className={`font-mono text-3xl font-bold tabular-nums lg:text-5xl ${tone}`}>{value}</p>
    </div>
  );
}

// French: singular for 0 and 1.
const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

const share = (part: number, whole: number) => `${whole > 0 ? (100 * part) / whole : 0}%`;

export default function TrackingScreen({ edition }: { edition: { id: number; year: number } }) {
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const status = useEventStream(`/api/arrivals/${edition.id}/tracking`, "summary", {
    summary: (data) => setSummary(data as TrackingSummary),
  });

  return (
    <div className="min-h-dvh bg-blanc-casse pb-10">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gris/20 bg-blanc px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-gris">Accueil DevFest {edition.year}</p>
          <h1 className="font-bold text-noir">Suivi des arrivées</h1>
        </div>
        <ConnectionIndicator status={status} />
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-6">
        {status === "disconnected" && (
          <div role="alert" className="rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
            Pas de connexion au serveur : les chiffres affichés peuvent être périmés.
          </div>
        )}

        {!summary ? (
          status !== "disconnected" && <p className="text-center text-gris">Chargement…</p>
        ) : (
          <>
            <section aria-label="Totaux" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Figure label="Attendus" value={summary.expected} />
              <Figure label="Scannés" value={summary.scanned} />
              <Figure label="Distribués" value={summary.delivered} />
              <Figure label="En attente" value={summary.waiting} tone={waitingTone(summary.waiting)} />
            </section>

            <section aria-labelledby="counters-title" className="rounded-3xl bg-blanc p-5 shadow-card">
              <h2 id="counters-title" className="mb-4 text-lg font-bold text-noir">
                Par guichet
              </h2>
              <ul className="flex flex-col gap-4">
                {summary.counters.map((c) => {
                  const waiting = c.toFetch + c.ready;
                  return (
                    <li key={c.counter} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 md:grid-cols-[7rem_minmax(0,1fr)_14rem]">
                      <span className="font-bold text-noir lg:text-xl">Guichet {c.counter}</span>
                      <div
                        role="img"
                        aria-label={`${c.delivered} distribués, ${c.ready} prêts, ${c.toFetch} à chercher sur ${c.numbered}`}
                        className="flex h-5 overflow-hidden rounded border border-gris/20 bg-gris/10 lg:h-8"
                      >
                        <span className="bg-malachite" style={{ width: share(c.delivered, c.numbered) }} />
                        <span className="bg-bleu" style={{ width: share(c.ready, c.numbered) }} />
                        <span className="bg-orange" style={{ width: share(c.toFetch, c.numbered) }} />
                      </div>
                      <span className="col-start-2 font-mono text-sm tabular-nums text-gris md:col-start-3 lg:text-base">
                        <b className="text-noir">{c.delivered}</b> / {c.numbered} ·{" "}
                        <b className={waitingTone(waiting)}>{waiting} en attente</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gris">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-malachite" />
                  Distribué
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-bleu" />
                  Prêt
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-orange" />À chercher
                </span>
              </p>
            </section>

            <section aria-label="Hors guichets" className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl bg-blanc p-5 shadow-card">
                <h2 className="text-sm font-medium uppercase tracking-wider text-gris">Accueil dédié</h2>
                <p className="font-mono text-3xl font-bold tabular-nums text-noir lg:text-4xl">
                  {summary.dedicated.scanned} <span className="text-gris">/ {summary.dedicated.expected}</span>
                </p>
                <p className="text-sm text-gris">speakers, staff, bénévoles, prestataires arrivés</p>
              </div>
              <div className="rounded-3xl bg-blanc p-5 shadow-card">
                <h2 className="text-sm font-medium uppercase tracking-wider text-gris">Guichet d&apos;aide</h2>
                <p className="font-mono text-3xl font-bold tabular-nums text-noir lg:text-4xl">
                  {summary.help.labelsDelivered}{" "}
                  <span className="font-sans text-base font-normal text-gris">
                    {plural(summary.help.labelsDelivered, "étiquette remise", "étiquettes remises")}
                  </span>
                </p>
                <p className="text-sm text-gris">
                  {summary.help.toHandle} à traiter · {summary.help.labelsPrinted}{" "}
                  {plural(summary.help.labelsPrinted, "impression", "impressions")}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
