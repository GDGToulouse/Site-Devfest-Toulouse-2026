import type { EditionSchedule, ScheduleEntry } from "./types";

// Turning the flat payload of /api/editions/:year/schedule into the rows a grid
// draws (#106).
//
// The rows are the distinct start times, not a fixed rhythm: every room starts
// its sessions at the same moments (checked against the 2025 agenda), so a
// `DISTINCT startsAt` is the row list — no need for a time-slot entity.
//
// Rooms do *not* all end at the same moment, though (#462). Two 20-minute
// quickies fill the 40 minutes of one conference, and the second of them opens
// a row of its own halfway through. A session therefore spans every row its
// range covers, or the rooms still running would be drawn as free — and since
// #455 they would be drawn as "nothing scheduled", which is worse than blank.
//
// Off-session entries — breaks, lunch, the party — are rows of their own,
// spanning every column. They do *not* reserve their time range: in 2025 lunch
// ran from 12:45 to 14:15 while quickies played at 12:55 and 13:50. So a band
// and sessions can share a moment, and the band never hides them.

export type ScheduleTalk = EditionSchedule["talks"][number];

/**
 * One talk as it occupies one room at one time.
 *
 * A keynote occupies several (#456): the room it is given in, and the rooms it
 * is relayed to. The relay is the same session, not another one — so it is the
 * same talk, the same slug, one favourite, one calendar entry — and only the
 * grid, which has a column per room, has any reason to draw it more than once.
 */
export interface ScheduleCell {
  talk: ScheduleTalk;
  isSimulcast: boolean;
  /**
   * How many rows of the grid this session occupies (#462).
   *
   * One, unless it outlasts its own row: two 20-minute quickies in one room
   * split a 40-minute slot in two, and the conferences running beside them have
   * to reach across both.
   */
  rowSpan: number;
}

export interface ScheduleSlotRow {
  type: "slot";
  key: string;
  startsAt: string;
  /** One bucket per room, in column order — what *starts* here. */
  cells: ScheduleCell[][];
  /**
   * Per column: a session that began in an earlier row is still running (#462).
   *
   * The grid draws no cell at all there, since the one above spans onto it.
   * Kept apart from `cells` so the linear views — the mobile agenda, the
   * by-hour print — can keep ignoring it: a list has no holes to fill.
   */
  covered: boolean[];
}

export interface ScheduleBandRow {
  type: "band";
  key: string;
  startsAt: string;
  entry: ScheduleEntry;
}

export type ScheduleRow = ScheduleSlotRow | ScheduleBandRow;

/**
 * How a talk is matched to its column.
 *
 * A room deleted after the fact, or a talk placed before the room existed,
 * leaves the id null and only the frozen label (#375) to go on — the endpoint
 * builds its column list the same way, so the two agree by construction.
 */
function roomKey(id: number | null, name: string | null): string {
  return id != null ? `id:${id}` : `label:${name ?? ""}`;
}

export function buildScheduleRows(schedule: EditionSchedule): ScheduleRow[] {
  const columns = schedule.rooms.map((room) => roomKey(room.id, room.name));

  // One row per distinct start time, created before anything is placed: a
  // session's span is counted in rows, so every row has to exist first.
  const slots = new Map<string, ScheduleSlotRow>();
  for (const talk of schedule.talks) {
    if (slots.has(talk.startsAt)) continue;
    slots.set(talk.startsAt, {
      type: "slot",
      key: `slot:${talk.startsAt}`,
      startsAt: talk.startsAt,
      cells: columns.map(() => []),
      covered: columns.map(() => false),
    });
  }

  // The model lets an entry name a room; no screen writes one today, so every
  // entry spans the grid.
  const bands: ScheduleBandRow[] = schedule.entries.map((entry) => ({
    type: "band",
    key: `entry:${entry.id}`,
    startsAt: entry.startsAt,
    entry,
  }));

  // Equal times put the band first: "coffee break" then whatever runs during it.
  const rows: ScheduleRow[] = [...bands, ...slots.values()].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      (a.type === b.type ? 0 : a.type === "band" ? -1 : 1),
  );

  for (const talk of schedule.talks) {
    const from = rows.findIndex((row) => row.type === "slot" && row.startsAt === talk.startsAt);
    const rowSpan = countRowsCovered(rows, from, talk.endsAt);

    const column = columns.indexOf(roomKey(talk.roomId, talk.room));
    // A talk whose column is missing would vanish from the grid; the endpoint
    // derives the columns from these very talks, so this cannot happen — but
    // dropping one silently is the kind of failure nobody notices, so it lands
    // in the first column rather than nowhere.
    place(rows, from, rowSpan, column === -1 ? 0 : column, { talk, isSimulcast: false, rowSpan });

    // The relay rooms carry the same talk (#456). A relay whose column is
    // missing is dropped rather than parked in column zero: unlike the room a
    // talk is given in, a relay the grid cannot place is not worth inventing a
    // position for.
    for (const relay of talk.simulcasts ?? []) {
      const relayColumn = columns.indexOf(roomKey(relay.roomId, relay.room));
      if (relayColumn === -1) continue;
      place(rows, from, rowSpan, relayColumn, { talk, isSimulcast: true, rowSpan });
    }
  }

  return rows;
}

/**
 * How many rows a session reaches across, starting at `from` (#462).
 *
 * A band is a full-width row, so no cell can span across one: a session that
 * outlasts a break stops at it rather than pushing the band sideways. Nothing
 * in the 2026 day does — the breaks fall between slots, never inside one — but
 * a schedule that did would otherwise render a broken table rather than an
 * imperfect one.
 */
function countRowsCovered(rows: ScheduleRow[], from: number, endsAt: string | null): number {
  // No end time — the 244 imported historical talks have none (#102) — means no
  // range to reach across, so the session stays in its own row.
  if (!endsAt) return 1;
  const end = Date.parse(endsAt);
  let span = 1;
  for (let index = from + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.type !== "slot" || Date.parse(row.startsAt) >= end) break;
    span += 1;
  }
  return span;
}

function place(
  rows: ScheduleRow[],
  from: number,
  rowSpan: number,
  column: number,
  cell: ScheduleCell,
): void {
  (rows[from] as ScheduleSlotRow).cells[column].push(cell);
  for (let offset = 1; offset < rowSpan; offset += 1) {
    (rows[from + offset] as ScheduleSlotRow).covered[column] = true;
  }
}
