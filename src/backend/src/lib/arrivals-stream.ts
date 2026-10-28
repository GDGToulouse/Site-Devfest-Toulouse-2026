import type { LiveBadge } from "./badge-state.js";

// The fan-out behind the arrivals screens' stream (RG-ARR-60, #641). In memory,
// like the scheduler: right while the backend runs as a single replica. A
// second one would need Postgres LISTEN/NOTIFY here, the only shared channel.

export type ArrivalsEvent = { type: "badge"; badge: LiveBadge };

type Listener = (event: ArrivalsEvent) => void;

const listeners = new Map<number, Set<Listener>>();

/** Listen to one edition's events; returns the unsubscribe. */
export function subscribeToArrivals(editionId: number, listener: Listener): () => void {
  let set = listeners.get(editionId);
  if (!set) {
    set = new Set();
    listeners.set(editionId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(editionId);
  };
}

export function publishArrivals(editionId: number, event: ArrivalsEvent): void {
  for (const listener of listeners.get(editionId) ?? []) listener(event);
}

/** Open streams on an edition: what a test waits on before acting. */
export function countArrivalsListeners(editionId: number): number {
  return listeners.get(editionId)?.size ?? 0;
}
