import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { EVENT_TIME_ZONE, parseWallTime } from "./zoned-time.js";
import { slotOfNumber } from "./badge-numbering.js";

// Station access without an account (RG-ARR-70 to RG-ARR-76, #775): a QR code
// per station opens it signed in. A volunteer who photographs it holds the same
// key as the one who scans it, so the key is narrow (one station, one edition),
// short-lived (a window the admin sets) and revocable (a generation the admin
// raises). There is no User behind it: a station is not a person, and a new
// kind of principal must never fall into EDITOR (.claude/rules/security.md).

export type Station =
  | { kind: "scan" }
  | { kind: "help" }
  | { kind: "counter"; counter: number; bin: number | null };

/** The station in a URL or a token: `scan`, `help`, `c2` (counter), `c2b1` (one bin of it). */
export function encodeStation(station: Station): string {
  if (station.kind === "counter") return station.bin === null ? `c${station.counter}` : `c${station.counter}b${station.bin}`;
  return station.kind;
}

const COUNTER_CODE = /^c([1-9])(?:b([1-9]))?$/;

export function parseStation(code: string): Station | null {
  if (code === "scan" || code === "help") return { kind: code };
  const match = COUNTER_CODE.exec(code);
  if (!match) return null;
  return { kind: "counter", counter: Number(match[1]), bin: match[2] ? Number(match[2]) : null };
}

/** The station as the team names it, on screen and on the printed page. */
export function stationName(station: Station): string {
  if (station.kind === "scan") return "Scan";
  if (station.kind === "help") return "Aide";
  return station.bin === null ? `Guichet ${station.counter}` : `Guichet ${station.counter} · présentoir ${station.bin}`;
}

/** What the audit log and the badge history read as author. */
export const stationLabel = (station: Station) => `Poste ${stationName(station)}`;

/** The frontend path of a station's screen. */
export function stationPath(station: Station): string {
  if (station.kind === "scan") return "/arrivees/scan";
  if (station.kind === "help") return "/arrivees/aide";
  const counter = `/arrivees/guichet/${station.counter}`;
  return station.bin === null ? counter : `${counter}/presentoir/${station.bin}`;
}

/** Every station an edition's layout holds: the admin prints one page for each. */
export function listStations(layout: { counters: number; binsPerCounter: number }): Station[] {
  const stations: Station[] = [{ kind: "scan" }, { kind: "help" }];
  for (let counter = 1; counter <= layout.counters; counter++) {
    stations.push({ kind: "counter", counter, bin: null });
    for (let bin = 1; bin <= layout.binsPerCounter; bin++) stations.push({ kind: "counter", counter, bin });
  }
  return stations;
}

/** The badges a counter station acts on: its counter's, narrowed to a bin when it has one (RG-ARR-42). */
export function isBadgeInScope(station: Station, badgeNumber: number | null): boolean {
  if (station.kind !== "counter" || badgeNumber === null) return false;
  const slot = slotOfNumber(badgeNumber);
  return slot.counter === station.counter && (station.bin === null || slot.bin === station.bin);
}

/** What each kind of station may call, by the capabilities the arrivals routes name. */
export type ArrivalsCapability = "stream" | "scan" | "search" | "offline" | "move" | "label" | "tracking";

const CAPABILITIES: Record<Station["kind"], readonly ArrivalsCapability[]> = {
  scan: ["stream", "scan", "search", "offline"],
  help: ["stream", "search", "label"],
  counter: ["stream", "move"],
};

export const canStationDo = (station: Station, capability: ArrivalsCapability) =>
  CAPABILITIES[station.kind].includes(capability);

// The links are derived, not stored (RG-ARR-73): HMAC-SHA256 of the station
// and generation under the server's secret. Nothing in the database lets a
// reader rebuild a link, a dump holds no working one, and the admin can print
// the sheets again later, which a hash-only table could not give back. Raising
// the generation invalidates every link and every session at once.
function secret(): string {
  const value = process.env.SESSION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required to sign station links");
  return value;
}

function sign(editionId: number, code: string, generation: number): string {
  return createHmac("sha256", secret())
    .update(`arrivals-station|${editionId}|${code}|${generation}`, "utf8")
    .digest("base64url");
}

/** The secret of a station link: `<edition>.<station>.<generation>.<signature>`. */
export function deriveStationToken(editionId: number, station: Station, generation: number): string {
  const code = encodeStation(station);
  return `${editionId}.${code}.${generation}.${sign(editionId, code, generation)}`;
}

const TOKEN_SHAPE = /^(\d{1,9})\.([a-z0-9]{2,8})\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/;

function parisDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export interface StationWindowSource {
  startDate: Date | null;
  endDate: Date | null;
  stationAccessFrom: Date | null;
  stationAccessUntil: Date | null;
}

/**
 * When the links open a station (RG-ARR-71): what the admin set, else the day
 * before the event (the rehearsal) at midnight through the event's last day,
 * Paris time. Null on a side with nothing set and no event date to derive from.
 */
export function stationWindow(edition: StationWindowSource): { from: Date | null; until: Date | null } {
  const firstDay = edition.startDate ? parisDay(edition.startDate) : null;
  const lastDay = edition.endDate ? parisDay(edition.endDate) : firstDay;
  return {
    from: edition.stationAccessFrom ?? (firstDay ? parseWallTime(`${dayBefore(firstDay)}T00:00:00`) : null),
    until: edition.stationAccessUntil ?? (lastDay ? parseWallTime(`${lastDay}T23:59:59`) : null),
  };
}

export type StationRefusal = "invalid" | "replaced" | "not_open_yet" | "closed";

const REFUSALS: Record<StationRefusal, string> = {
  invalid: "Ce lien de poste n'est pas valable. Demandez le QR code à l'équipe DevFest.",
  replaced: "Ce QR code a été remplacé par un nouveau. Demandez le QR code à jour à l'équipe DevFest.",
  not_open_yet: "Ce poste n'est pas encore ouvert.",
  closed: "L'accueil de cette édition est terminé : ce QR code n'ouvre plus rien.",
};

export type StationCheck =
  | { ok: true; editionId: number; station: Station; until: Date }
  | { ok: false; reason: StationRefusal; message: string };

const refuse = (reason: StationRefusal, message = REFUSALS[reason]): StationCheck => ({ ok: false, reason, message });

function formatMoment(instant: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/**
 * Whether a link, or the session it opened, still stands: signed for that
 * station, of the current generation, inside the window, on an edition that
 * exists and still has the station. Read from the database each time, so a
 * regeneration or a changed window takes effect on the next request.
 */
export async function checkStationToken(token: string, now: Date = new Date()): Promise<StationCheck> {
  const match = TOKEN_SHAPE.exec(token);
  if (!match) return refuse("invalid");
  const editionId = Number(match[1]);
  const code = match[2];
  const generation = Number(match[3]);

  const expected = Buffer.from(sign(editionId, code, generation));
  const given = Buffer.from(match[4]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return refuse("invalid");

  const station = parseStation(code);
  if (!station) return refuse("invalid");
  const edition = await prisma.edition.findFirst({
    where: { id: editionId, ...notDeleted },
    select: {
      startDate: true,
      endDate: true,
      stationAccessFrom: true,
      stationAccessUntil: true,
      stationAccessGeneration: true,
      badgeCounters: true,
      badgeBinsPerCounter: true,
    },
  });
  if (!edition) return refuse("invalid");
  if (generation !== edition.stationAccessGeneration) return refuse("replaced");
  if (
    station.kind === "counter" &&
    (station.counter > edition.badgeCounters || (station.bin !== null && station.bin > edition.badgeBinsPerCounter))
  ) {
    return refuse("invalid");
  }

  const { from, until } = stationWindow(edition);
  // No window at all (no event date, nothing set) is closed, never open.
  if (!until || !from) return refuse("closed");
  if (now < from) return refuse("not_open_yet", `Ce poste ouvre le ${formatMoment(from)}.`);
  if (now > until) return refuse("closed");
  return { ok: true, editionId, station, until };
}

// The session is the token itself, in a cookie that only travels to
// /api/arrivals: it is checked as above on every request, and dies with the
// window or the next regeneration.
export const STATION_COOKIE = "devfest_station";
const COOKIE_PATH = "/api/arrivals";

export function readStationCookie(request: FastifyRequest): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === STATION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

export function stationCookie(token: string, until: Date, now: Date = new Date()): string {
  const maxAge = Math.max(0, Math.floor((until.getTime() - now.getTime()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STATION_COOKIE}=${encodeURIComponent(token)}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}
