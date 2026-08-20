import type { EditionSchedule, ScheduleEntry } from "./types";

// Turning the flat payload of /api/editions/:year/schedule into the rows a grid
// draws (#106).
//
// The rows are the distinct start times, not a fixed rhythm: every room starts
// its sessions at the same moments (checked against the 2025 agenda), so a
// `DISTINCT startsAt` is the row list — no need for a time-slot entity.
//
// Off-session entries — breaks, lunch, the party — are rows of their own,
// spanning every column. They do *not* reserve their time range: in 2025 lunch
// ran from 12:45 to 14:15 while quickies played at 12:55 and 13:50. So a band
// and sessions can share a moment, and the band never hides them.

export type ScheduleTalk = EditionSchedule["talks"][number];

export interface ScheduleSlotRow {
  type: "slot";
  key: string;
  startsAt: string;
  /** One bucket per room, in column order. Normally 0 or 1 talk each. */
  cells: ScheduleTalk[][];
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

  const slots = new Map<string, ScheduleSlotRow>();
  for (const talk of schedule.talks) {
    let slot = slots.get(talk.startsAt);
    if (!slot) {
      slot = {
        type: "slot",
        key: `slot:${talk.startsAt}`,
        startsAt: talk.startsAt,
        cells: columns.map(() => []),
      };
      slots.set(talk.startsAt, slot);
    }
    const column = columns.indexOf(roomKey(talk.roomId, talk.room));
    // A talk whose column is missing would vanish from the grid; the endpoint
    // derives the columns from these very talks, so this cannot happen — but
    // dropping one silently is the kind of failure nobody notices, so it lands
    // in the first column rather than nowhere.
    slot.cells[column === -1 ? 0 : column].push(talk);
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
  return [...bands, ...[...slots.values()]].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      (a.type === b.type ? 0 : a.type === "band" ? -1 : 1),
  );
}
