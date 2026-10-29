// The live state of the event-day screens (#641), as the stream delivers it:
// a full snapshot on every (re)connection, then one badge at a time. Pure
// functions, so the merge rules are tested apart from EventSource.

export type BadgeState = "PRINTED" | "TO_FETCH" | "READY" | "DELIVERED";

export interface LiveBadge {
  id: number;
  number: number;
  state: BadgeState;
  version: number;
  /** When it reached `state`, ISO. */
  since: string | null;
  /** Handed over as a label at the help desk: off its counter's screen (#713). */
  byLabel: boolean;
  /** Scanned during an outage, sent afterwards: maybe handed over by hand already (#645). */
  scannedOffline: boolean;
  /** When the person was scanned, ISO: orders À chercher. */
  scannedAt: string | null;
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
  /** Label handed over: done, off the "to handle" list (#713). */
  labelDeliveredAt: string | null;
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

/**
 * A ticket sent to the help desk, or handed its label: one the screen already
 * lists is updated in place, never added twice.
 */
export function applyHelp(state: LiveState, entry: HelpEntry): LiveState {
  const index = state.help.findIndex((h) => h.id === entry.id);
  if (index < 0) return { ...state, help: [...state.help, entry] };
  return { ...state, help: state.help.map((h, i) => (i === index ? entry : h)) };
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

/** Delivered cards a counter keeps in view: enough to undo a slip (RG-ARR-41). */
export const DELIVERED_SHOWN = 10;

export interface CounterBoard {
  /** By scan time, oldest first: the first to arrive is the first to fetch. */
  toFetch: LiveBadge[];
  /** Oldest first, in the order they were laid on the counter. */
  ready: LiveBadge[];
  /** The latest DELIVERED_SHOWN, latest first. */
  delivered: LiveBadge[];
  /** Cards to fetch per bin, every bin of the layout listed. */
  toFetchByBin: number[];
}

const sinceTime = (badge: LiveBadge) => (badge.since ? Date.parse(badge.since) : 0);
// Ties (a backfilled date, or none) fall back on the number: stable across screens.
const bySince = (a: LiveBadge, b: LiveBadge) => sinceTime(a) - sinceTime(b) || a.number - b.number;
// À chercher follows the queue: a card sent back from Prêt is almost always a
// slip, and its person has waited since the scan, not since the slip.
const scanTime = (badge: LiveBadge) => (badge.scannedAt ? Date.parse(badge.scannedAt) : sinceTime(badge));
const byScan = (a: LiveBadge, b: LiveBadge) => scanTime(a) - scanTime(b) || a.number - b.number;

/** A counter's kanban (#643), narrowed to one bin for the phone that follows only its own. */
export function counterBoard(state: LiveState, counter: number, bin: number | null): CounterBoard {
  const board: CounterBoard = {
    toFetch: [],
    ready: [],
    delivered: [],
    toFetchByBin: Array.from({ length: state.layout.binsPerCounter }, () => 0),
  };
  for (const badge of state.badges.values()) {
    // A label from the help desk is not the counter's to hand over (RG-ARR-52).
    if (counterOf(badge.number) !== counter || badge.byLabel) continue;
    const badgeBin = binOf(badge.number);
    if (badge.state === "TO_FETCH" && badgeBin < board.toFetchByBin.length) board.toFetchByBin[badgeBin]++;
    if (bin !== null && badgeBin !== bin) continue;
    if (badge.state === "TO_FETCH") board.toFetch.push(badge);
    else if (badge.state === "READY") board.ready.push(badge);
    else if (badge.state === "DELIVERED") board.delivered.push(badge);
  }
  board.toFetch.sort(byScan);
  board.ready.sort(bySince);
  board.delivered = board.delivered.sort((a, b) => bySince(b, a)).slice(0, DELIVERED_SHOWN);
  return board;
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
    // Labels are counted apart (RG-ARR-52).
    if (!load || badge.byLabel) continue;
    if (badge.state === "TO_FETCH") load.toFetch++;
    else if (badge.state === "READY") load.ready++;
    else if (badge.state === "DELIVERED") load.delivered++;
  }
  return loads;
}
