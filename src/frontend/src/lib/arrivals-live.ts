// The live state of the event-day screens (#641), as the stream delivers it:
// a full snapshot on every (re)connection, then one badge at a time. Pure
// functions, so the merge rules are tested apart from EventSource.

export type BadgeState = "PRINTED" | "TO_FETCH" | "READY" | "DELIVERED";

export interface LiveBadge {
  id: number;
  number: number;
  state: BadgeState;
  version: number;
  firstName: string;
  lastName: string;
  company: string | null;
}

export interface BadgeLayout {
  counters: number;
  binsPerCounter: number;
}

export interface ArrivalsSnapshot {
  layout: BadgeLayout;
  frozenAt: string | null;
  badges: LiveBadge[];
}

export interface LiveState {
  layout: BadgeLayout;
  frozenAt: string | null;
  /** Badges that left Imprimé, by attendee id. */
  badges: Map<number, LiveBadge>;
}

/** A snapshot replaces everything: it is the server's word after a break (RG-ARR-61). */
export function fromSnapshot(snapshot: ArrivalsSnapshot): LiveState {
  return {
    layout: snapshot.layout,
    frozenAt: snapshot.frozenAt,
    badges: new Map(snapshot.badges.map((badge) => [badge.id, badge])),
  };
}

/**
 * One badge that moved. Skipped when not newer than what the screen holds: an
 * event queued while the snapshot loaded can repeat it. Back in Imprimé, the
 * badge leaves the screens.
 */
export function applyBadge(state: LiveState, badge: LiveBadge): LiveState {
  const known = state.badges.get(badge.id);
  if (known && known.version >= badge.version) return state;
  const badges = new Map(state.badges);
  if (badge.state === "PRINTED") badges.delete(badge.id);
  else badges.set(badge.id, badge);
  return { ...state, badges };
}

// Counter × 1000 + bin × 100 + rank (RG-ARR-15).
export const counterOf = (badgeNumber: number) => Math.floor(badgeNumber / 1000);
export const binOf = (badgeNumber: number) => Math.floor((badgeNumber % 1000) / 100);

export interface CounterLoad {
  counter: number;
  toFetch: number;
  ready: number;
  delivered: number;
}

/** Each counter's cards by column, every counter of the layout listed. */
export function counterLoads(state: LiveState): CounterLoad[] {
  const loads = Array.from({ length: state.layout.counters }, (_, i) => ({
    counter: i + 1,
    toFetch: 0,
    ready: 0,
    delivered: 0,
  }));
  for (const badge of state.badges.values()) {
    const load = loads[counterOf(badge.number) - 1];
    if (!load) continue;
    if (badge.state === "TO_FETCH") load.toFetch++;
    else if (badge.state === "READY") load.ready++;
    else if (badge.state === "DELIVERED") load.delivered++;
  }
  return loads;
}
