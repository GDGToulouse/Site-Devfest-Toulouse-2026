import type { ScheduleEntryKind } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { validateWebhookUrl } from "./webhook-url.js";
import { parseWallTime } from "./zoned-time.js";

// The Sessionize service sessions — welcome, breaks, lunch, keynotes still
// without a speaker, the after — as schedule entries of the grid (#546).
//
// The "All" view the import reads does not carry them at all: only the
// "GridSmart" view does, flagged `isServiceSession`, with a GUID for an id.

export interface SzServiceSlot {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  roomId: number | null;
  /** Spans every room: a break, lunch, the opening. */
  isPlenumSession: boolean;
}

interface GridSession {
  id: string | number;
  title?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  roomId?: number | null;
  isServiceSession?: boolean;
  isPlenumSession?: boolean;
}

interface GridDay {
  rooms?: { id: number; sessions?: GridSession[] }[];
}

export interface ServiceSlotsReport {
  created: number;
  updated: number;
  deleted: number;
}

/** The GridSmart view of the same event, from the URL of any other view. */
export function gridSmartUrl(url: string): string | null {
  const match = url.trim().match(/^(https:\/\/sessionize\.com\/api\/v2\/[^/]+\/view\/)[^/?#]+/i);
  return match ? `${match[1]}GridSmart` : null;
}

/**
 * The service sessions of a GridSmart payload, once each. A plenum session is
 * listed under every room; the "Intermède" fillers between two quickies are
 * left out — the grid already shows those gaps as empty cells (#455).
 */
export function extractServiceSlots(grid: unknown): SzServiceSlot[] {
  if (!Array.isArray(grid)) throw new Error("GridSmart payload is not a list of days.");
  const byId = new Map<string, SzServiceSlot>();
  for (const day of grid as GridDay[]) {
    for (const room of day.rooms ?? []) {
      for (const session of room.sessions ?? []) {
        if (!session.isServiceSession) continue;
        const title = session.title?.trim() ?? "";
        if (!title || /^interm[eè]de/i.test(title)) continue;
        const id = String(session.id);
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          title,
          startsAt: session.startsAt ?? null,
          endsAt: session.endsAt ?? null,
          roomId: session.roomId ?? room.id,
          isPlenumSession: Boolean(session.isPlenumSession),
        });
      }
    }
  }
  return [...byId.values()];
}

/** Fetches the service sessions of the event behind an import URL. */
export async function loadServiceSlots(importUrl: string): Promise<SzServiceSlot[]> {
  const url = gridSmartUrl(importUrl);
  if (!url) throw new Error("Lien Sessionize non reconnu : impossible d'en déduire la vue GridSmart.");
  // Derived from a URL typed in the back-office: still user input (#306).
  await validateWebhookUrl(url);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sessionize GridSmart fetch failed: HTTP ${res.status}`);
  return extractServiceSlots(await res.json());
}

const KIND_KEYWORDS: Array<[RegExp, ScheduleEntryKind]> = [
  [/d[ée]jeuner|lunch|repas|breakfast/i, "MEAL"],
  [/pause|break|caf[ée]/i, "BREAK"],
  [/\bafter\b|soir[ée]e|ap[ée]ro|party/i, "SOCIAL"],
];

export function slotKind(title: string): ScheduleEntryKind {
  return KIND_KEYWORDS.find(([re]) => re.test(title))?.[1] ?? "OTHER";
}

// The labels the 2026 programme uses; anything else keeps its French label,
// which the admin can translate in the Planning tab.
const ENGLISH_LABELS: Record<string, string> = {
  "petit déjeuner": "Breakfast",
  "petit-déjeuner": "Breakfast",
  "présentation de la journée": "Welcome",
  accueil: "Welcome",
  "keynote d'ouverture": "Opening keynote",
  "keynote d’ouverture": "Opening keynote",
  "keynote clôture": "Closing keynote",
  "keynote de clôture": "Closing keynote",
  pause: "Break",
  déjeuner: "Lunch",
  clôture: "Closing",
  after: "After party",
};

export function englishLabel(labelFr: string): string {
  return ENGLISH_LABELS[labelFr.trim().toLowerCase()] ?? labelFr;
}

// The same slot, worded alike or worded as a known variant: production typed
// "Keynote de clôture" where Sessionize says "Keynote clôture".
function sameLabel(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const known = (label: string) => ENGLISH_LABELS[label.trim().toLowerCase()];
  return Boolean(known(a)) && known(a) === known(b);
}

/**
 * Brings the edition's imported schedule entries in line with Sessionize:
 * creates the new ones, moves and renames the known ones, deletes the ones
 * Sessionize no longer has — including a keynote that became a real session.
 * Entries typed by hand are never touched, except that a hand-made entry with
 * the same label and the same times is adopted on the first import rather
 * than duplicated: beta and production had their slots typed in on 2026-10-06.
 */
export async function syncServiceSlots(
  editionId: number,
  slots: SzServiceSlot[],
  venueRoomOf: (sessionizeRoomId: number) => number | null,
  warnings: string[],
): Promise<ServiceSlotsReport> {
  const report: ServiceSlotsReport = { created: 0, updated: 0, deleted: 0 };
  const existing = await prisma.scheduleEntry.findMany({ where: { editionId } });
  const imported = new Map(existing.filter((e) => e.sessionizeId).map((e) => [e.sessionizeId!, e]));
  const handMade = existing.filter((e) => !e.sessionizeId);
  const seen = new Set<string>();

  for (const slot of slots) {
    // Seen before anything else: an unreadable time keeps the entry as it was
    // rather than deleting it as if Sessionize had dropped it.
    seen.add(slot.id);
    const startsAt = parseWallTime(slot.startsAt);
    const endsAt = parseWallTime(slot.endsAt);
    if (!startsAt || !endsAt) {
      warnings.push(`Créneau « ${slot.title} » : horaire illisible, non importé.`);
      continue;
    }
    const roomId = slot.isPlenumSession || slot.roomId == null ? null : venueRoomOf(slot.roomId);
    const placement = { labelFr: slot.title, startsAt, endsAt, roomId };

    const known = imported.get(slot.id);
    if (known) {
      const unchanged =
        known.labelFr === slot.title &&
        known.startsAt.getTime() === startsAt.getTime() &&
        known.endsAt.getTime() === endsAt.getTime() &&
        known.roomId === roomId;
      if (unchanged) continue;
      await prisma.scheduleEntry.update({
        where: { id: known.id },
        // A renamed slot gets the default English label again; an untouched
        // label keeps whatever the admin translated it to.
        data: { ...placement, ...(known.labelFr !== slot.title ? { labelEn: englishLabel(slot.title) } : {}) },
      });
      report.updated++;
      continue;
    }

    const twin = handMade.find(
      (e) => sameLabel(e.labelFr, slot.title) && e.startsAt.getTime() === startsAt.getTime() && e.endsAt.getTime() === endsAt.getTime(),
    );
    if (twin) {
      handMade.splice(handMade.indexOf(twin), 1);
      // Adopted: linked to Sessionize and worded as Sessionize words it, so the
      // next import finds nothing to change. The English label typed by hand stays.
      await prisma.scheduleEntry.update({ where: { id: twin.id }, data: { sessionizeId: slot.id, labelFr: slot.title } });
      report.updated++;
      continue;
    }

    await prisma.scheduleEntry.create({
      data: { editionId, sessionizeId: slot.id, kind: slotKind(slot.title), labelEn: englishLabel(slot.title), ...placement },
    });
    report.created++;
  }

  const gone = [...imported.values()].filter((e) => !seen.has(e.sessionizeId!));
  if (gone.length > 0) {
    await prisma.scheduleEntry.deleteMany({ where: { id: { in: gone.map((e) => e.id) } } });
    report.deleted = gone.length;
  }
  return report;
}
