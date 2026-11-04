"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import CounterSearch from "@/components/arrivals/CounterSearch";
import { moveBadge } from "@/lib/arrivals-api";
import {
  DELIVERED_SHOWN,
  binColor,
  formatBadgeNumber,
  binOf,
  counterBoard,
  type BadgeState,
  type LiveBadge,
  type LiveState,
} from "@/lib/arrivals-live";

// A counter's screen (RG-ARR-41 to RG-ARR-46, #643): the laptop at the back
// of the counter, or a volunteer's phone on the same counter. Touching a
// card moves it one step; every move names where the card starts from, so the
// laptop and a phone touching the same card move it once (RG-ARR-44). The
// number is what the volunteer scans for from a step away, so it takes the card
// (#776); no instructions are printed on the screen, the gesture is the card.

/** Where a touch on the card sends it (RG-ARR-43). */
const TOUCH: Partial<Record<BadgeState, BadgeState>> = {
  TO_FETCH: "READY",
  READY: "DELIVERED",
  DELIVERED: "READY",
};

const TOUCH_WORDS: Partial<Record<BadgeState, string>> = {
  TO_FETCH: "passer en Prêt",
  READY: "passer en Distribué",
  DELIVERED: "revenir en Prêt",
};

/** How long a card found by the search stays ringed. */
const POINTED_MS = 4_000;

const SIGNAL_VIBRATION_MS = 200;
const SIGNAL_TONE_HZ = 880;
const SIGNAL_TONE_S = 0.15;

/**
 * A short beep and a buzz when a card arrives to fetch. Browsers keep sound
 * off until the page is touched: the screen says so while it is.
 */
function useArrivalSignal() {
  const contextRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    function unlock() {
      contextRef.current ??= new AudioContext();
      void contextRef.current.resume().then(() => setIsMuted(contextRef.current?.state !== "running"));
    }
    // On click, not pointerdown: the "son coupé" banner goes once sound is on,
    // and gone between finger down and up it moved the cards, so a volunteer's
    // first touch on a card landed on the grid (#777).
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  useEffect(() => () => void contextRef.current?.close(), []);

  const signal = useCallback(() => {
    navigator.vibrate?.(SIGNAL_VIBRATION_MS);
    const context = contextRef.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = SIGNAL_TONE_HZ;
    oscillator.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + SIGNAL_TONE_S);
  }, []);

  return { isMuted, signal };
}

function Card({
  badge,
  isBusy,
  isPointed,
  onTouch,
  actions,
}: {
  badge: LiveBadge;
  isBusy: boolean;
  /** Found by the search: ringed for a moment (#802). */
  isPointed: boolean;
  onTouch: () => void;
  /** Secondary gestures beside the card: a symbol, and what it does. */
  actions: Array<{ symbol: string; label: string; onClick: () => void }>;
}) {
  const bin = binOf(badge.number);
  const isDone = badge.state === "DELIVERED";
  // Scanned during an outage: the counter may have handed it over by hand (#645).
  const isFromOutage = badge.scannedOffline && badge.state === "TO_FETCH";
  return (
    <li id={`badge-card-${badge.id}`} className={`flex items-stretch gap-1 ${isDone && !isPointed ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onTouch}
        disabled={isBusy}
        aria-label={`Badge ${formatBadgeNumber(badge.number)}, ${badge.firstName} ${badge.lastName} : ${TOUCH_WORDS[badge.state]}`}
        className={`flex min-w-0 flex-1 items-stretch gap-3 overflow-hidden rounded-xl border bg-blanc py-3 pr-3 text-left hover:border-bleu focus-visible:border-bleu disabled:opacity-50 ${
          isPointed ? "border-terre-cuite ring-4 ring-terre-cuite" : "border-gris/20"
        }`}
      >
        <span aria-hidden="true" className={`w-3 shrink-0 ${binColor(bin)}`} />
        <span className="min-w-0">
          <span
            className={`block font-mono font-bold leading-none tabular-nums text-noir ${
              isDone ? "text-3xl" : "text-5xl 2xl:text-6xl"
            }`}
          >
            {formatBadgeNumber(badge.number)}
          </span>
          <span className="mt-2 block truncate text-lg font-medium text-noir">
            {badge.firstName} {badge.lastName}
          </span>
          <span className="block truncate text-sm text-gris">
            {badge.company ? `${badge.company} · ` : ""}présentoir {bin}
          </span>
          {isFromOutage && (
            <span className="block text-sm font-medium text-orange">Scanné pendant la coupure : déjà remis ?</span>
          )}
          {badge.isRefunded && (
            <span className="block text-sm font-bold text-rouge">Remboursé : ne pas remettre, l&apos;Aide vient le chercher</span>
          )}
        </span>
      </button>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={isBusy}
          aria-label={`Badge ${formatBadgeNumber(badge.number)} : ${action.label}`}
          title={action.label}
          className="shrink-0 rounded-xl border border-gris/20 bg-blanc px-3 text-xl text-gris hover:border-bleu hover:text-noir disabled:opacity-50"
        >
          {action.symbol}
        </button>
      ))}
    </li>
  );
}

function Column({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-2xl bg-gris/10 p-3" aria-label={title}>
      <h2 className="flex justify-between text-sm font-medium uppercase tracking-wider text-gris">
        <span>{title}</span>
        <span className="font-mono tabular-nums">{count}</span>
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

export default function CounterBoard({
  editionId,
  counter,
  live,
  canStepBack,
  onMoved,
}: {
  editionId: number;
  counter: number;
  live: LiveState;
  canStepBack: boolean;
  onMoved: (badge: LiveBadge) => void;
}) {
  const board = counterBoard(live, counter);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pointedId, setPointedId] = useState<number | null>(null);
  const { isMuted, signal } = useArrivalSignal();
  const shownIds = new Set([...board.toFetch, ...board.ready, ...board.delivered].map((b) => b.id));

  // The card the search found: brought into view, ringed long enough to be seen.
  useEffect(() => {
    if (pointedId === null) return;
    document.getElementById(`badge-card-${pointedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setPointedId(null), POINTED_MS);
    return () => clearTimeout(timer);
  }, [pointedId]);

  // A new card to fetch: beep. The first state the screen gets is not news.
  const seenRef = useRef<Set<number> | null>(null);
  const toFetchIds = board.toFetch.map((b) => b.id).join(",");
  useEffect(() => {
    const ids = new Set(toFetchIds ? toFetchIds.split(",").map(Number) : []);
    const seen = seenRef.current;
    if (seen && [...ids].some((id) => !seen.has(id))) signal();
    seenRef.current = ids;
  }, [toFetchIds, signal]);

  async function move(badge: LiveBadge, to: BadgeState) {
    setBusyIds((ids) => new Set(ids).add(badge.id));
    const { data } = await moveBadge(editionId, badge.id, badge.state, to);
    setBusyIds((ids) => {
      const next = new Set(ids);
      next.delete(badge.id);
      return next;
    });
    if (data) {
      setError(null);
      onMoved(data.badge);
    } else {
      // Stays until a move goes through: a lost touch must not pass for a done one.
      setError(`Le badge ${formatBadgeNumber(badge.number)} n'a pas bougé : vérifiez la connexion, puis touchez la carte à nouveau.`);
    }
  }

  const card = (badge: LiveBadge, actions: Array<{ symbol: string; label: string; to: BadgeState }>) => (
    <Card
      key={badge.id}
      badge={badge}
      isBusy={busyIds.has(badge.id)}
      isPointed={pointedId === badge.id}
      onTouch={() => {
        const to = TOUCH[badge.state];
        // A refunded badge is never handed over (#800): the server refuses it too.
        if (to === "DELIVERED" && badge.isRefunded) {
          setError(`Le badge ${formatBadgeNumber(badge.number)} est remboursé : ne le remettez pas, l'Aide vient le chercher.`);
          return;
        }
        if (to) void move(badge, to);
      }}
      actions={actions.map((action) => ({ ...action, onClick: () => void move(badge, action.to) }))}
    />
  );

  const toFetchActions = (badge: LiveBadge) => [
    // Handed over by hand during the outage: straight to Distribué (RG-ARR-67).
    ...(badge.scannedOffline ? [{ symbol: "✓", label: "déjà remis pendant la coupure", to: "DELIVERED" as const }] : []),
    ...(canStepBack ? [{ symbol: "↩", label: "remettre en Imprimé", to: "PRINTED" as const }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-base text-noir">
        <span className="text-gris">À chercher par présentoir</span>
        {board.toFetchByBin.map((count, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-gris/30 px-2.5 py-0.5"
          >
            <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${binColor(i + 1)}`} />
            présentoir {i + 1} : <b className="font-mono tabular-nums">{count}</b>
          </span>
        ))}
      </div>

      {isMuted && (
        <p className="rounded-2xl bg-orange/15 p-3 text-sm text-noir">
          Son coupé par le navigateur : touchez l&apos;écran une fois pour entendre l&apos;arrivée des badges.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-rouge/10 p-3 text-sm text-noir">
          {error}
        </p>
      )}

      <CounterSearch editionId={editionId} counter={counter} live={live} shownIds={shownIds} onShow={setPointedId} />

      {/* Side by side on a wide screen, and on any phone turned sideways (#802). */}
      <div className="grid gap-3 md:grid-cols-3 landscape:grid-cols-3">
        <Column title="À chercher" count={String(board.toFetch.length)}>
          {board.toFetch.map((badge) => card(badge, toFetchActions(badge)))}
        </Column>
        <Column title="Prêt" count={String(board.ready.length)}>
          {board.ready.map((badge) => card(badge, [{ symbol: "↩", label: "remettre à chercher", to: "TO_FETCH" }]))}
        </Column>
        <Column title="Distribué" count={`${DELIVERED_SHOWN} derniers`}>
          {board.delivered.map((badge) => card(badge, []))}
        </Column>
      </div>
    </div>
  );
}
