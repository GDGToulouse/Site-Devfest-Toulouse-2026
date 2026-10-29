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

/** A scanned ticket without a number, waiting at the help desk (#642). */
export interface HelpEntry {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
  scannedAt: string;
}

export interface ArrivalsSnapshot {
  layout: BadgeLayout;
  frozenAt: string | null;
  badges: LiveBadge[];
  help: HelpEntry[];
}

export interface LiveState {
  layout: BadgeLayout;
  frozenAt: string | null;
  /** Badges that left Imprimé, by attendee id. */
  badges: Map<number, LiveBadge>;
  /** Oldest first. */
  help: HelpEntry[];
}

/** A snapshot replaces everything: it is the server's word after a break (RG-ARR-61). */
export function fromSnapshot(snapshot: ArrivalsSnapshot): LiveState {
  return {
    layout: snapshot.layout,
    frozenAt: snapshot.frozenAt,
    badges: new Map(snapshot.badges.map((badge) => [badge.id, badge])),
    help: snapshot.help,
  };
}

/** A ticket sent to the help desk; one the screen already lists is not added twice. */
export function applyHelp(state: LiveState, entry: HelpEntry): LiveState {
  if (state.help.some((h) => h.id === entry.id)) return state;
  return { ...state, help: [...state.help, entry] };
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

/**
 * Each bin's colour, so a volunteer spots theirs at a glance (RG-ARR-42).
 * Bins are numbered from 0 (RG-ARR-15); up to MAX_BINS_PER_COUNTER (10) on the backend.
 */
const BIN_COLORS = [
  "bg-malachite",
  "bg-bleu",
  "bg-terre-cuite",
  "bg-rose",
  "bg-bleu-2",
  "bg-vert-2",
  "bg-orange",
  "bg-bismarck",
  "bg-emeraude",
  "bg-noir",
];

export const binColor = (bin: number) => BIN_COLORS[bin % BIN_COLORS.length];

/** Waiting badges above which a counter turns orange, then red, on the Scan phones (RG-ARR-36). */
export const LOAD_WARNING = 10;
export const LOAD_CRITICAL = 20;

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
