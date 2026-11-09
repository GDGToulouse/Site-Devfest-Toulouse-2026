import { prisma } from "./prisma.js";

// A sponsor's booth scans badges (#813). The scan keeps the code only: each
// read looks the ticket up again, so the list and the export follow the
// imported attendees as they are now (a corrected name, a cancelled ticket),
// and a code that matches no live ticket is shown as it was read.
//
// The code is the only way in: nothing here searches attendees by name or
// lists them, so a sponsor learns about a person only from a badge that person
// held out.

/** Longest code accepted: a Billetweb code is ~20 characters, a stray QR code may be a URL. */
export const SCAN_CODE_MAX = 512;

// A booth scans a few hundred badges at most; the guard keeps a read bounded.
const SCANS_MAX = 5_000;

export interface SponsorScanItem {
  id: number;
  scannedAt: Date;
  scannedBy: string;
  /** The person, when the code is a live ticket of the edition. */
  attendee: { firstName: string; lastName: string; company: string | null } | null;
  /** The code as read, only when it names no live ticket. */
  code: string | null;
}

interface LiveTicket {
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
}

// A code shared by a live and a cancelled ticket (an exchange) names the live
// one, as at the entrance (arrivals-scan.ts).
async function liveTicketsByCode(editionId: number, codes: string[]): Promise<Map<string, LiveTicket>> {
  if (codes.length === 0) return new Map();
  const rows = await prisma.attendee.findMany({
    where: { editionId, barcode: { in: codes }, isCancelled: false },
    select: { barcode: true, firstName: true, lastName: true, email: true, company: true },
    orderBy: { id: "asc" },
  });
  const byCode = new Map<string, LiveTicket>();
  for (const { barcode, ...ticket } of rows) {
    if (!byCode.has(barcode)) byCode.set(barcode, ticket);
  }
  return byCode;
}

type ScanRow = { id: number; code: string; scannedAt: Date; scannedByLabel: string };

function toItem(row: ScanRow, ticket: LiveTicket | undefined): SponsorScanItem {
  return {
    id: row.id,
    scannedAt: row.scannedAt,
    scannedBy: row.scannedByLabel,
    attendee: ticket ? { firstName: ticket.firstName, lastName: ticket.lastName, company: ticket.company } : null,
    code: ticket ? null : row.code,
  };
}

/** Record a scan; the same code twice keeps the first one and says so. */
export async function recordSponsorScan(
  editionId: number,
  sponsorId: number,
  code: string,
  scannedByLabel: string,
): Promise<{ item: SponsorScanItem; isDuplicate: boolean }> {
  const where = { editionId_sponsorId_code: { editionId, sponsorId, code } };
  const existing = await prisma.sponsorScan.findUnique({ where });
  const row =
    existing ??
    (await prisma.sponsorScan
      .create({ data: { editionId, sponsorId, code, scannedByLabel } })
      // Two phones of the same booth reading the same badge at once.
      .catch(async () => prisma.sponsorScan.findUniqueOrThrow({ where })));
  const tickets = await liveTicketsByCode(editionId, [code]);
  return { item: toItem(row, tickets.get(code)), isDuplicate: existing !== null };
}

async function loadScans(editionId: number, sponsorId: number) {
  const rows = await prisma.sponsorScan.findMany({
    where: { editionId, sponsorId },
    select: { id: true, code: true, scannedAt: true, scannedByLabel: true },
    orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
    take: SCANS_MAX,
  });
  const tickets = await liveTicketsByCode(editionId, [...new Set(rows.map((r) => r.code))]);
  return { rows, tickets };
}

/** The booth's scans, latest first. */
export async function listSponsorScans(editionId: number, sponsorId: number): Promise<SponsorScanItem[]> {
  const { rows, tickets } = await loadScans(editionId, sponsorId);
  return rows.map((row) => toItem(row, tickets.get(row.code)));
}

// A cell starting with = + - @ (or a tab/CR) is run as a formula by Excel:
// names come from Billetweb, typed by whoever bought the ticket.
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_HEADER = ["Prénom", "Nom", "E-mail", "Entreprise", "Scanné le", "Scanné par", "Code non reconnu"];

function parisTime(date: Date) {
  return date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

/**
 * The export (#813): UTF-8 with a BOM and `;`, which a French Excel opens
 * straight into columns with its accents (same choice as sponsor-guest-csv.ts).
 * Unrecognised codes stay in, with the code as read and no person.
 */
export async function sponsorScansCsv(editionId: number, sponsorId: number): Promise<string> {
  const { rows, tickets } = await loadScans(editionId, sponsorId);
  const lines = rows.map((row) => {
    const t = tickets.get(row.code);
    return [
      t?.firstName ?? "",
      t?.lastName ?? "",
      t?.email ?? "",
      t?.company ?? "",
      parisTime(row.scannedAt),
      row.scannedByLabel,
      t ? "" : row.code,
    ];
  });
  return `﻿${[CSV_HEADER, ...lines].map((cells) => cells.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
