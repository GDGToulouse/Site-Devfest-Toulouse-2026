import { buildScheduleRows, type ScheduleCell } from "./schedule";
import type { EditionSchedule, ScheduleEntry, ScheduleRoom } from "./types";
import { formatEventTime } from "./datetime";
import { localizedField } from "./i18n-helpers";

// The plain view of the programme (#755), for the people who work from it
// rather than attend it: a designer copying titles and names into a kakemono,
// a camera operator printing a room's sheet with room for notes, a sponsor
// wanting the day on one page.
//
// Title and speakers are always there, the times by default, the rest is
// chosen. The choice lives in the URL, like `?print=` (#449), so the link
// handed to a partner keeps it.

export const TEXT_FIELDS = ["time", "format", "category", "language", "level", "notes"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

/** What a link without `fields` shows: nobody reads a programme without its times. */
export const DEFAULT_FIELDS: readonly TextField[] = ["time"];

/**
 * The chosen fields, in display order: unknown names and repeats are dropped.
 *
 * No parameter is the default; an empty one is a choice of its own — someone
 * who unticked the times does not want them back on the next load.
 */
export function parseFields(param: string | null | undefined): TextField[] {
  if (param === null || param === undefined) return [...DEFAULT_FIELDS];
  const asked = new Set(param.split(","));
  return TEXT_FIELDS.filter((field) => asked.has(field));
}

/** The `fields` parameter for a choice, or null when it is the default. */
export function formatFieldsParam(fields: readonly TextField[]): string | null {
  const ordered = TEXT_FIELDS.filter((field) => fields.includes(field));
  const isDefault = ordered.length === DEFAULT_FIELDS.length && ordered.every((f, i) => f === DEFAULT_FIELDS[i]);
  return isDefault ? null : ordered.join(",");
}

/** Room by room (a sheet per door), or hour by hour (the day in order). */
export type TextGrouping = "room" | "time";

export function parseGrouping(param: string | null | undefined): TextGrouping {
  return param === "time" ? "time" : "room";
}

/** A room id from the URL; anything else shows every room. */
export function parseRoom(param: string | null | undefined): number | null {
  return param && /^\d+$/.test(param) ? Number(param) : null;
}

/** One session as listed: by time it carries its room, by room the heading does. */
export type TextItem = Pick<ScheduleCell, "talk" | "isSimulcast"> & { roomName?: string; roomId?: number | null };

export interface RoomSection {
  room: ScheduleRoom;
  items: TextItem[];
}

/**
 * Each room's sessions in time order, then the moments every room shares.
 *
 * Built on the grid's rows, like the by-room print (#449), so a relayed keynote
 * shows on the sheet of every room it plays in (#456).
 */
export function buildRoomSections(schedule: EditionSchedule): { rooms: RoomSection[]; bands: ScheduleEntry[] } {
  const rows = buildScheduleRows(schedule);
  const rooms = schedule.rooms
    .map((room, index) => ({
      room,
      items: rows.flatMap((row) => (row.type === "slot" ? (row.cells[index] ?? []) : [])),
    }))
    .filter((section) => section.items.length > 0);
  const bands = rows.flatMap((row) => (row.type === "band" ? [row.entry] : []));
  return { rooms, bands };
}

export type TimeSection =
  | { type: "slot"; key: string; startsAt: string; items: TextItem[] }
  | { type: "band"; key: string; entry: ScheduleEntry };

/**
 * The day in order: one section per start time, the shared moments in place.
 *
 * A keynote is listed once, in the room it is given in, not once per relay
 * room — as in the by-hour print (#449).
 */
export function buildTimeSections(schedule: EditionSchedule): TimeSection[] {
  return buildScheduleRows(schedule).map((row) =>
    row.type === "band"
      ? { type: "band", key: row.key, entry: row.entry }
      : {
          type: "slot",
          key: row.key,
          startsAt: row.startsAt,
          items: row.cells.flatMap((cells, index) =>
            cells
              .filter((cell) => !cell.isSimulcast)
              .map((cell) => ({
                talk: cell.talk,
                isSimulcast: false,
                roomName: schedule.rooms[index]?.name ?? "",
                roomId: schedule.rooms[index]?.id ?? null,
              })),
          ),
        },
  );
}

export interface TextLabels {
  formatLabels: Record<string, string>;
  levelLabels: Record<string, string>;
  languageLabels: Record<string, string>;
  simulcast: string;
  roomTba: string;
}

export function timeRange(startsAt: string, endsAt: string | null): string {
  return endsAt ? `${formatEventTime(startsAt)} – ${formatEventTime(endsAt)}` : formatEventTime(startsAt);
}

/**
 * The value of each shown field of one session, in display order.
 *
 * Notes have no value: on paper they are blank space, in a copy nothing.
 */
export function sessionValues(
  { talk, isSimulcast, roomName }: TextItem,
  fields: readonly TextField[],
  locale: string,
  labels: TextLabels,
): { time?: string; title: string; speakers: string; room?: string; extra: string[]; simulcast?: string } {
  const extra: string[] = [];
  for (const field of fields) {
    if (field === "format") extra.push(labels.formatLabels[talk.format] ?? "");
    if (field === "category") extra.push(talk.category ? localizedField(talk.category, "name", locale) : "");
    if (field === "language") extra.push(labels.languageLabels[talk.language] ?? "");
    if (field === "level") extra.push(talk.level ? (labels.levelLabels[talk.level] ?? "") : "");
  }
  return {
    time: fields.includes("time") ? timeRange(talk.startsAt, talk.endsAt) : undefined,
    title: talk.title,
    speakers: talk.speakers.map((speaker) => speaker.name).join(", "),
    room: roomName === undefined ? undefined : roomName || labels.roomTba,
    extra,
    simulcast: isSimulcast ? labels.simulcast : undefined,
  };
}

/**
 * A section as plain text: a line per session, fields separated by tabs.
 *
 * Tabs, because the same paste has to land cleanly in a design tool (one line
 * per session) and in a spreadsheet (one cell per field). An empty field keeps
 * its tab, so the columns stay aligned from one line to the next.
 */
export function sectionToText(
  items: readonly TextItem[],
  fields: readonly TextField[],
  locale: string,
  labels: TextLabels,
): string {
  return items
    .map((item) => {
      const values = sessionValues(item, fields, locale, labels);
      return [
        ...(values.time !== undefined ? [values.time] : []),
        values.title,
        values.speakers,
        ...(values.room !== undefined ? [values.room] : []),
        ...values.extra,
        ...(values.simulcast ? [values.simulcast] : []),
      ].join("\t");
    })
    .join("\n");
}
