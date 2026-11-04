"use client";

import { useEffect, useState } from "react";

import { searchAttendees, type SearchHit } from "@/lib/arrivals-api";
import { binOf, counterOf, formatBadgeNumber, type BadgeState, type LiveState } from "@/lib/arrivals-live";

// A counter looks someone up across the edition (#802): a person at the wrong
// counter, or a card lost in a long column. It never moves a card: a counter
// acts on its own badges only (RG-ARR-72).

/** Pause after the last keystroke before searching: one request per name, not per letter. */
const SEARCH_DEBOUNCE_MS = 300;

const STATE_WORDS: Record<BadgeState, string> = {
  PRINTED: "pas encore scanné",
  TO_FETCH: "à chercher",
  READY: "prêt",
  DELIVERED: "distribué",
};

/** Where the person stands, as the counter tells them. */
export function whereTo(hit: SearchHit, state: BadgeState, counter: number): string {
  if (hit.isCancelled) return "Billet annulé : guichet d'aide";
  if (hit.isDedicated) return "Accueil dédié";
  if (hit.badgeNumber === null) return "Sans badge : guichet d'aide";
  const number = formatBadgeNumber(hit.badgeNumber);
  const where = counterOf(hit.badgeNumber) === counter ? "Ici" : `Au guichet ${counterOf(hit.badgeNumber)}`;
  if (state === "PRINTED") return `${where}, badge ${number} sur le présentoir ${binOf(hit.badgeNumber)} : ${STATE_WORDS[state]}`;
  return `${where}, badge ${number} : ${STATE_WORDS[state]}`;
}

export default function CounterSearch({
  editionId,
  counter,
  live,
  shownIds,
  onShow,
}: {
  editionId: number;
  counter: number;
  live: LiveState;
  /** The cards on the board: Distribué keeps only its latest ones. */
  shownIds: Set<number>;
  /** A person whose card is on the board: point at it. */
  onShow: (badgeId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      searchAttendees(editionId, trimmed).then(({ data }) => {
        setHits(data);
        setIsFailed(!data);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [editionId, query]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="counter-query" className="sr-only">
        Chercher quelqu&apos;un : nom, prénom ou numéro de badge
      </label>
      <input
        id="counter-query"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher : nom ou numéro de badge"
        autoComplete="off"
        enterKeyHint="search"
        className="rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-noir"
      />
      {isFailed && (
        <p role="alert" className="rounded-2xl bg-rouge/10 p-3 text-sm text-noir">
          La recherche n&apos;a pas abouti : vérifiez la connexion, puis réessayez.
        </p>
      )}
      {hits && (
        <ul className="flex flex-col gap-2" aria-label="Résultats de la recherche">
          {hits.length === 0 && <li className="text-sm text-gris">Personne à ce nom ou à ce numéro.</li>}
          {hits.map((hit) => {
            const state = live.badges.get(hit.id)?.state ?? hit.badgeState;
            const isOnBoard = shownIds.has(hit.id);
            return (
              <li key={hit.id} className="flex items-center gap-2 rounded-2xl border border-gris/30 bg-blanc px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-noir">
                    {hit.firstName} {hit.lastName}
                  </span>
                  <span className="block text-sm text-gris">
                    {[hit.company, whereTo(hit, state, counter)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {isOnBoard && (
                  <button
                    type="button"
                    onClick={() => {
                      onShow(hit.id);
                      setQuery("");
                    }}
                    className="shrink-0 rounded-xl border border-bleu px-3 py-2 text-sm font-medium text-bleu"
                  >
                    Voir la carte
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
