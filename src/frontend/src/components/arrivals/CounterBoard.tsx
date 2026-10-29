"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { moveBadge } from "@/lib/arrivals-api";
import {
  DELIVERED_SHOWN,
  binColor,
  binOf,
  counterBoard,
  type BadgeState,
  type LiveBadge,
  type LiveState,
} from "@/lib/arrivals-live";

// A counter's screen (RG-ARR-41 to RG-ARR-46, #643): the laptop at the back
// of the counter, or a volunteer's phone narrowed to their bin. Touching a
// card moves it one step; every move names where the card starts from, so the
// laptop and a phone touching the same card move it once (RG-ARR-44).

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
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
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
  onTouch,
  actions,
}: {
  badge: LiveBadge;
  isBusy: boolean;
  onTouch: () => void;
  /** Secondary gestures beside the card: a symbol, and what it does. */
  actions: Array<{ symbol: string; label: string; onClick: () => void }>;
}) {
  const bin = binOf(badge.number);
  const isDone = badge.state === "DELIVERED";
  // Scanned during an outage: the counter may have handed it over by hand (#645).
  const isFromOutage = badge.scannedOffline && badge.state === "TO_FETCH";
  return (
    <li className={`flex items-stretch gap-1 ${isDone ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onTouch}
        disabled={isBusy}
        aria-label={`Badge ${badge.number}, ${badge.firstName} ${badge.lastName} : ${TOUCH_WORDS[badge.state]}`}
        className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl border border-gris/20 bg-blanc py-2 pr-3 text-left hover:border-bleu focus-visible:border-bleu disabled:opacity-50"
      >
        <span aria-hidden="true" className={`w-2 self-stretch ${binColor(bin)}`} />
        <span className={`font-mono font-bold tabular-nums text-noir ${isDone ? "text-lg" : "text-2xl"}`}>
          {badge.number}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-noir">
            {badge.firstName} {badge.lastName}
          </span>
          <span className="block truncate text-xs text-gris">
            {badge.company ? `${badge.company} · ` : ""}bac {bin}
          </span>
          {isFromOutage && (
            <span className="block text-xs font-medium text-orange">Scanné pendant la coupure : déjà remis ?</span>
          )}
        </span>
      </button>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={isBusy}
          aria-label={`Badge ${badge.number} : ${action.label}`}
          title={action.label}
          className="shrink-0 rounded-xl border border-gris/20 bg-blanc px-2 text-gris hover:border-bleu hover:text-noir disabled:opacity-50"
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
      <h3 className="flex justify-between text-xs font-medium uppercase tracking-wider text-gris">
        <span>{title}</span>
        <span className="font-mono tabular-nums">{count}</span>
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

export default function CounterBoard({
  editionId,
  counter,
  bin,
  live,
  canStepBack,
  onMoved,
}: {
  editionId: number;
  counter: number;
  bin: number | null;
  live: LiveState;
  canStepBack: boolean;
  onMoved: (badge: LiveBadge) => void;
}) {
  const board = counterBoard(live, counter, bin);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { isMuted, signal } = useArrivalSignal();

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
      setError(`Le badge ${badge.number} n'a pas bougé : vérifiez la connexion, puis touchez la carte à nouveau.`);
    }
  }

  const card = (badge: LiveBadge, actions: Array<{ symbol: string; label: string; to: BadgeState }>) => (
    <Card
      key={badge.id}
      badge={badge}
      isBusy={busyIds.has(badge.id)}
      onTouch={() => {
        const to = TOUCH[badge.state];
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
      <div className="flex flex-wrap items-center gap-2 text-sm text-noir">
        <span className="text-gris">À chercher par bac</span>
        {board.toFetchByBin.map((count, b) => (
          <span
            key={b}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${
              bin === b ? "border-noir" : "border-gris/30"
            }`}
          >
            <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${binColor(b)}`} />
            bac {b} : <b className="font-mono tabular-nums">{count}</b>
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

      <div className="grid gap-3 md:grid-cols-3">
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

      <p className="text-sm text-gris">
        Touchez une carte pour la faire avancer : À chercher → Prêt → Distribué. Une carte distribuée par erreur revient
        en Prêt d&apos;un toucher ; ↩ ramène une carte Prête à chercher. Une carte scannée pendant une coupure de
        réseau a ✓ : le badge a été remis à la main entre-temps, elle passe directement en Distribué.
      </p>
    </div>
  );
}
