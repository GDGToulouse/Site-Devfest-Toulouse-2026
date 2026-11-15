import { createHash } from "node:crypto";

import { EVENT_TIME_ZONE, offsetAt } from "./zoned-time.js";

// The programme as a `schedule.xml` (#827): the format born with Pentabarf,
// carried on by frab and pretalx, whose schema the CCC video team keeps
// (https://c3voc.de/wiki/schedule). Conference apps read it — Giggity,
// EventFahrplan, the Fahrplan iOS app, info-beamer — so a participant gets the
// grid offline, with favourites and reminders, without an app of ours.
//
// Written by hand like the .ics (#443): a few elements, and the rules that bite
// are the schema's patterns. A test validates the output against the XSD.

export interface ScheduleTalk {
  id: number;
  slug: string;
  title: string;
  description: string;
  format: "CONFERENCE" | "QUICKIE" | "KEYNOTE" | "WORKSHOP";
  language: string;
  start: Date;
  end: Date | null;
  room: string;
  /** Orders the rooms of a day, as the grid does; ties fall back to the name. */
  roomOrder: number;
  track: string | null;
  speakers: Array<{ id: number; name: string }>;
  url: string;
}

export interface ScheduleConference {
  year: number;
  baseUrl: string;
  generatorVersion: string;
  /** Changes whenever the programme does: apps compare it to refresh. */
  version: string;
}

// What an app shows as the kind of session. English: apps print it as is,
// and the format's other producers speak English.
const TYPES: Record<ScheduleTalk["format"], string> = {
  CONFERENCE: "Talk",
  QUICKIE: "Quickie",
  KEYNOTE: "Keynote",
  WORKSHOP: "Workshop",
};

/** XML text and attribute escaping, and the control characters XML 1.0 forbids. */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A UUID that never changes for the same key (name-based, SHA-1, as UUID v5).
 * Apps key favourites on the event's guid: one that moved on each export would
 * drop everybody's selection at every refresh.
 */
export function stableUuid(key: string): string {
  const hex = createHash("sha1").update(`devfesttoulouse.fr/${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// The schema's slug: a prefix and at least four characters after the dash.
// Optional in the format, so a slug that cannot match is left out rather than
// made up: a talk created as "TBD" keeps the slug `tbd` once renamed (#827).
const SCHEDULE_SLUG = /^[a-z0-9_]{4,}-[a-z0-9_-]{4,}$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** The instant as Toulouse reads it: date, time and the offset of that day. */
function paris(instant: Date) {
  const offsetMinutes = Math.round(offsetAt(instant, EVENT_TIME_ZONE) / 60000);
  const wall = new Date(instant.getTime() + offsetMinutes * 60000);
  const date = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  const time = `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
  const sign = offsetMinutes < 0 ? "-" : "+";
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
  return { date, time, dateTime: `${date}T${time}:00${offset}` };
}

/** `HH:MM`; a session without an end lasts "00:00" rather than an invented slot. */
function duration(start: Date, end: Date | null): string {
  const minutes = end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : 0;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function slugLine(slug: string): string[] {
  return SCHEDULE_SLUG.test(slug) ? [`        <slug>${slug}</slug>`] : [];
}

export function buildScheduleXml(conference: ScheduleConference, talks: ScheduleTalk[]): string {
  const acronym = `devfest-toulouse-${conference.year}`;
  const sorted = [...talks].sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));

  // One <day> per Toulouse calendar day, in order: a session at 00:30 UTC on
  // the 20th is still the evening of the 19th in Paris.
  const days = new Map<string, ScheduleTalk[]>();
  for (const talk of sorted) {
    const { date } = paris(talk.start);
    days.set(date, [...(days.get(date) ?? []), talk]);
  }
  const dayDates = [...days.keys()];

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<schedule>",
    `  <generator name="devfesttoulouse.fr" version="${escapeXml(conference.generatorVersion)}"/>`,
    `  <url>${escapeXml(`${conference.baseUrl}/api/editions/${conference.year}/schedule.xml`)}</url>`,
    `  <version>${escapeXml(conference.version)}</version>`,
    "  <conference>",
    `    <title>DevFest Toulouse ${conference.year}</title>`,
    `    <acronym>${acronym}</acronym>`,
  ];
  if (dayDates.length > 0) {
    lines.push(`    <start>${dayDates[0]}</start>`, `    <end>${dayDates[dayDates.length - 1]}</end>`);
  }
  lines.push(
    `    <days>${dayDates.length}</days>`,
    `    <time_zone_name>${EVENT_TIME_ZONE}</time_zone_name>`,
    `    <base_url>${escapeXml(`${conference.baseUrl}/`)}</base_url>`,
    `    <url>${escapeXml(`${conference.baseUrl}/`)}</url>`,
    "  </conference>",
  );

  dayDates.forEach((date, index) => {
    const dayTalks = days.get(date)!;
    const first = Math.min(...dayTalks.map((t) => t.start.getTime()));
    const last = Math.max(...dayTalks.map((t) => (t.end ?? t.start).getTime()));
    lines.push(
      `  <day index="${index + 1}" date="${date}" start="${paris(new Date(first)).dateTime}" end="${paris(new Date(last)).dateTime}">`,
    );

    const rooms = new Map<string, ScheduleTalk[]>();
    for (const talk of [...dayTalks].sort((a, b) => a.roomOrder - b.roomOrder || a.room.localeCompare(b.room))) {
      rooms.set(talk.room, [...(rooms.get(talk.room) ?? []), talk]);
    }
    for (const [room, roomTalks] of rooms) {
      lines.push(`    <room name="${escapeXml(room)}" guid="${stableUuid(`${conference.year}/room/${room}`)}">`);
      for (const talk of roomTalks.sort((a, b) => a.start.getTime() - b.start.getTime())) {
        const at = paris(talk.start);
        lines.push(
          // Keyed on the id, not the slug: both are fixed once the talk exists,
          // but the id is what the database guarantees.
          `      <event id="${talk.id}" guid="${stableUuid(`${conference.year}/talk/${talk.id}`)}">`,
          `        <date>${at.dateTime}</date>`,
          `        <start>${at.time}</start>`,
          `        <duration>${duration(talk.start, talk.end)}</duration>`,
          `        <room>${escapeXml(talk.room)}</room>`,
          ...slugLine(`devfesttoulouse${conference.year}-${talk.slug}`),
          `        <title>${escapeXml(talk.title)}</title>`,
          `        <track>${escapeXml(talk.track ?? "")}</track>`,
          `        <type>${TYPES[talk.format]}</type>`,
          `        <language>${escapeXml(talk.language)}</language>`,
          `        <abstract>${escapeXml(talk.description)}</abstract>`,
          "        <persons>",
          ...talk.speakers.map((s) => `          <person id="${s.id}">${escapeXml(s.name)}</person>`),
          "        </persons>",
          `        <url>${escapeXml(talk.url)}</url>`,
          "      </event>",
        );
      }
      lines.push("    </room>");
    }
    lines.push("  </day>");
  });

  lines.push("</schedule>", "");
  return lines.join("\n");
}
