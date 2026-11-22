import { readSheet } from "read-excel-file/node";
import { prisma } from "./prisma.js";
import { slugify } from "./slug.js";
import { isEmailAddress } from "./email-address.js";

// The speakers' contact addresses, from the Excel export of Sessionize's
// organizer app (#866). Sessionize's API never gives them out — it is public
// — so this file is the only way in. It fills empty addresses and nothing
// else: an address already on the site wins, and a difference is reported.

// One line per session and per speaker: a speaker with two sessions shows twice.
const COLUMNS = { speakerId: "Speaker Id", firstName: "FirstName", lastName: "LastName", email: "Email" } as const;

export interface SessionizeContact {
  sessionizeId: string;
  name: string;
  email: string;
}

export interface EmailImportReport {
  added: string[];
  unchanged: string[];
  different: Array<{ name: string; current: string; file: string }>;
  notFound: string[];
  invalid: string[];
}

export class SpreadsheetError extends Error {}

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

/** The speakers in the export, one each, with the address it gives them. */
export async function readSessionizeContacts(file: Buffer): Promise<{ contacts: SessionizeContact[]; invalid: string[] }> {
  let rows;
  try {
    rows = await readSheet(file);
  } catch {
    throw new SpreadsheetError("Ce fichier ne se lit pas comme un export Excel (.xlsx).");
  }
  const header = (rows[0] ?? []).map(text);
  const index = Object.fromEntries(Object.entries(COLUMNS).map(([key, title]) => [key, header.indexOf(title)])) as Record<keyof typeof COLUMNS, number>;
  const missing = Object.entries(COLUMNS).filter(([key]) => index[key as keyof typeof COLUMNS] < 0).map(([, title]) => title);
  if (missing.length > 0) {
    throw new SpreadsheetError(`Colonnes absentes de l'export : ${missing.join(", ")}. Est-ce bien l'export des sessions de Sessionize ?`);
  }

  const bySpeaker = new Map<string, SessionizeContact>();
  const invalid = new Set<string>();
  for (const row of rows.slice(1)) {
    const sessionizeId = text(row[index.speakerId]);
    if (!sessionizeId || bySpeaker.has(sessionizeId)) continue;
    const name = `${text(row[index.firstName])} ${text(row[index.lastName])}`.trim();
    const email = text(row[index.email]).toLowerCase();
    if (!name || !isEmailAddress(email)) {
      invalid.add(name || `Speaker ${sessionizeId}`);
      continue;
    }
    bySpeaker.set(sessionizeId, { sessionizeId, name, email });
  }
  return { contacts: [...bySpeaker.values()], invalid: [...invalid] };
}

/**
 * Fills the empty contact addresses. A speaker is found by their Sessionize
 * id first, then by name (the slug the Sessionize import gives them), and is
 * then given that id. Nothing is created and nothing is sent.
 */
export async function importSessionizeContacts(contacts: SessionizeContact[]): Promise<Omit<EmailImportReport, "invalid">> {
  const report: Omit<EmailImportReport, "invalid"> = { added: [], unchanged: [], different: [], notFound: [] };
  const speakers = await prisma.speaker.findMany({
    where: {
      deletedAt: null,
      OR: [{ sessionizeId: { in: contacts.map((c) => c.sessionizeId) } }, { slug: { in: contacts.map((c) => slugify(c.name)) } }],
    },
    select: { id: true, name: true, slug: true, contactEmail: true, sessionizeId: true },
  });
  const bySessionizeId = new Map(speakers.filter((s) => s.sessionizeId).map((s) => [s.sessionizeId!, s]));
  const bySlug = new Map(speakers.map((s) => [s.slug, s]));

  for (const contact of contacts) {
    const fromSlug = bySlug.get(slugify(contact.name));
    // A name match already tied to another Sessionize id is someone else.
    const speaker = bySessionizeId.get(contact.sessionizeId) ?? (fromSlug && !fromSlug.sessionizeId ? fromSlug : undefined);
    if (!speaker) {
      report.notFound.push(contact.name);
      continue;
    }
    const current = speaker.contactEmail?.trim() || null;
    const data = {
      ...(speaker.sessionizeId ? {} : { sessionizeId: contact.sessionizeId }),
      ...(current ? {} : { contactEmail: contact.email }),
    };
    if (Object.keys(data).length > 0) {
      await prisma.speaker.update({ where: { id: speaker.id }, data });
      speaker.sessionizeId = contact.sessionizeId;
    }
    if (!current) report.added.push(speaker.name);
    else if (current.toLowerCase() === contact.email) report.unchanged.push(speaker.name);
    else report.different.push({ name: speaker.name, current, file: contact.email });
  }
  return report;
}
