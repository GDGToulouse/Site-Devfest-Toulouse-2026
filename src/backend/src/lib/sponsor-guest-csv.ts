import { guestData, type GuestBody } from "./sponsor-guests.js";
import { GUEST_DIETS, GUEST_EXPERIENCES, GUEST_GENDERS } from "./sponsor-guests.js";

// Importing sponsor guests from a spreadsheet (#729, RG-INS-30 to RG-INS-35).
// The files come from Excel on Windows as often as from Google Sheets, so the
// reader takes `;` or `,`, quoted or not, UTF-8 or Windows-1252 — the encoding
// a French Excel uses for "CSV (séparateur : point-virgule)".

// The labels the sponsor reads, which are also the option labels of the
// Billetweb ticket form (« Sup à 7 ans », from its export): one wording for
// both, so what a sponsor picks is what the ticket shows.
export const GENDER_LABELS: Record<(typeof GUEST_GENDERS)[number], string> = {
  FEMALE: "Femme",
  MALE: "Homme",
  UNSPECIFIED: "Non spécifié",
};
export const EXPERIENCE_LABELS: Record<(typeof GUEST_EXPERIENCES)[number], string> = {
  STUDENT: "Etudiant",
  UNDER_3_YEARS: "Inf. à 3 ans",
  FROM_3_TO_7_YEARS: "Entre 3 et 7 ans",
  OVER_7_YEARS: "Sup à 7 ans",
};
export const DIET_LABELS: Record<(typeof GUEST_DIETS)[number], string> = {
  NONE: "Pas de régime particulier",
  VEGETARIAN: "Végétarien",
  VEGAN: "Végan",
  OTHER: "Autre (je précise par mail)",
};

type Field = keyof Required<GuestBody>;

// Template columns, in order. The list columns carry their allowed values in
// the header, so the sponsor does not need the documentation open (RG-INS-30).
const COLUMNS: Array<{ field: Field; header: string }> = [
  { field: "lastName", header: "Nom" },
  { field: "firstName", header: "Prénom" },
  { field: "email", header: "E-mail" },
  { field: "gender", header: `Genre (${Object.values(GENDER_LABELS).join(" / ")})` },
  { field: "experience", header: `Expérience professionnelle (${Object.values(EXPERIENCE_LABELS).join(" / ")})` },
  { field: "attendsAfterParty", header: "Je participe à l'after à partir de 18h00 (oui / non)" },
  { field: "diet", header: `Régime alimentaire (${Object.values(DIET_LABELS).join(" / ")})` },
  { field: "needsAssistance", header: "J'ai besoin d'une assistance particulière, précisée par mail (oui / non)" },
];

const REQUIRED: Field[] = ["lastName", "firstName", "email", "gender", "experience"];

const EXAMPLE = ["Dupont", "Marie", "marie.dupont@example.com", "Femme", "Entre 3 et 7 ans", "oui", "Pas de régime particulier", "non"];

function csvCell(value: string) {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The downloadable template: UTF-8 with a BOM and `;`, which a French Excel
 * opens straight into columns with its accents — without the BOM it reads the
 * file as Windows-1252 and garbles them; with `,` it puts everything in column A.
 */
export function guestCsvTemplate(): string {
  const lines = [COLUMNS.map((c) => c.header), EXAMPLE].map((cells) => cells.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * UTF-8 when the bytes are valid UTF-8, Windows-1252 otherwise (RG-INS-31). A
 * Windows-1252 file with accents is never valid UTF-8 (é is a lone 0xE9), so
 * the strict decode tells them apart; a pure-ASCII file reads the same either way.
 */
export function decodeCsv(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** Splits CSV text into rows of cells, quotes and doubled quotes included. */
export function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** `;` or `,`, whichever the header line uses more, outside quotes. */
export function detectSeparator(text: string): ";" | "," {
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  const semicolons = firstLine.split(";").length - 1;
  const commas = firstLine.split(",").length - 1;
  return commas > semicolons ? "," : ";";
}

/** Lowercase, no accents, no punctuation: « Inf. à 3 ans » → « infa3ans ». */
export function squash(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Header → field, by keyword: a sponsor who retypes « Prénom » as « prenom »
// or drops the list of values from the header still lands on the right column.
// « prenom » first, since it contains « nom ».
function fieldOfHeader(header: string): Field | null {
  const h = squash(header.replace(/\(.*\)/, ""));
  if (!h) return null;
  if (h.includes("prenom") || h === "firstname") return "firstName";
  if (h.includes("nom") || h === "lastname") return "lastName";
  if (h.includes("mail") || h.includes("courriel")) return "email";
  if (h.includes("genre") || h === "gender") return "gender";
  if (h.includes("experience")) return "experience";
  if (h.includes("after")) return "attendsAfterParty";
  if (h.includes("regime") || h === "diet") return "diet";
  if (h.includes("assistance")) return "needsAssistance";
  return null;
}

const GENDER_VALUES: Record<string, GuestBody["gender"]> = {
  femme: "FEMALE",
  f: "FEMALE",
  female: "FEMALE",
  homme: "MALE",
  h: "MALE",
  m: "MALE",
  male: "MALE",
  nonspecifie: "UNSPECIFIED",
  nonspecifiee: "UNSPECIFIED",
  ns: "UNSPECIFIED",
};

const EXPERIENCE_VALUES: Record<string, GuestBody["experience"]> = {
  etudiant: "STUDENT",
  etudiante: "STUDENT",
  infa3ans: "UNDER_3_YEARS",
  moinsde3ans: "UNDER_3_YEARS",
  // « < 3 ans » and « > 7 ans » once the signs are squashed away.
  "3ans": "UNDER_3_YEARS",
  entre3et7ans: "FROM_3_TO_7_YEARS",
  de3a7ans: "FROM_3_TO_7_YEARS",
  supa7ans: "OVER_7_YEARS",
  plusde7ans: "OVER_7_YEARS",
  "7ans": "OVER_7_YEARS",
};

// The readers below serve the CSV and the Billetweb answers alike (#731): a
// label written by a sponsor or an option of the ticket form.
export function genderOf(value: string): GuestBody["gender"] | undefined {
  return GENDER_VALUES[squash(value)];
}

export function experienceOf(value: string): GuestBody["experience"] | undefined {
  return EXPERIENCE_VALUES[squash(value)];
}

export function dietOf(value: string): GuestBody["diet"] | undefined {
  const v = squash(value);
  if (v === "" || v.startsWith("pasde") || v === "aucun" || v === "non" || v === "none") return "NONE";
  if (v.startsWith("vegetarien")) return "VEGETARIAN";
  if (v.startsWith("vegan")) return "VEGAN";
  if (v.startsWith("autre")) return "OTHER";
  return undefined;
}

// x / empty is how people tick a box in a spreadsheet (RG-INS-32).
export function booleanOf(value: string): boolean | undefined {
  const v = squash(value);
  if (["oui", "o", "x", "1", "true", "yes", "y", "vrai"].includes(v)) return true;
  if (["non", "n", "", "0", "false", "no", "faux"].includes(v)) return false;
  return undefined;
}

export interface CsvLineError {
  line: number;
  message: string;
}

export type GuestCsvResult =
  | { ok: true; guests: Array<GuestBody & { line: number }> }
  | { ok: false; fileError: string }
  | { ok: false; lineErrors: CsvLineError[] };

// A ceiling well above a sponsor's real list (a Platinum pack is 8 places):
// it only stops a wrong file — a whole export — from being read line by line.
const MAX_LINES = 500;

/**
 * Reads a guest CSV into rows ready for `guestData`, or says what is wrong:
 * a file-level problem (missing column, empty file) or every faulty line, so
 * the sponsor fixes the file in one pass (RG-INS-33).
 */
export function readGuestCsv(bytes: Uint8Array): GuestCsvResult {
  const text = decodeCsv(bytes);
  const rows = parseCsv(text, detectSeparator(text)).filter((cells) => cells.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { ok: false, fileError: "Le fichier est vide." };
  if (rows.length - 1 > MAX_LINES) {
    return { ok: false, fileError: `Le fichier compte plus de ${MAX_LINES} lignes : ce n'est pas une liste d'invités.` };
  }

  const columns = rows[0].map(fieldOfHeader);
  const missing = REQUIRED.filter((f) => !columns.includes(f));
  if (missing.length > 0) {
    const names = missing.map((f) => COLUMNS.find((c) => c.field === f)!.header.replace(/ \(.*\)$/, ""));
    return { ok: false, fileError: `Colonne${names.length > 1 ? "s" : ""} manquante${names.length > 1 ? "s" : ""} : ${names.join(", ")}.` };
  }

  const guests: Array<GuestBody & { line: number }> = [];
  const lineErrors: CsvLineError[] = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const raw: Partial<Record<Field, string>> = {};
    columns.forEach((field, i) => {
      if (field && raw[field] === undefined) raw[field] = (cells[i] ?? "").trim();
    });

    const problems: string[] = [];
    for (const field of ["lastName", "firstName", "email"] as const) {
      if (!raw[field]) problems.push(`${COLUMNS.find((c) => c.field === field)!.header} manquant`);
    }
    const gender = genderOf(raw.gender ?? "");
    if (!gender) problems.push(`genre « ${raw.gender ?? ""} » inconnu`);
    const experience = experienceOf(raw.experience ?? "");
    if (!experience) problems.push(`expérience « ${raw.experience ?? ""} » inconnue`);
    const diet = dietOf(raw.diet ?? "");
    if (!diet) problems.push(`régime « ${raw.diet} » inconnu`);
    const attendsAfterParty = booleanOf(raw.attendsAfterParty ?? "");
    if (attendsAfterParty === undefined) problems.push(`after « ${raw.attendsAfterParty} » : oui ou non attendu`);
    const needsAssistance = booleanOf(raw.needsAssistance ?? "");
    if (needsAssistance === undefined) problems.push(`assistance « ${raw.needsAssistance} » : oui ou non attendu`);

    if (problems.length > 0) {
      lineErrors.push({ line, message: problems.join(", ") });
      return;
    }
    guests.push({
      line,
      lastName: raw.lastName!,
      firstName: raw.firstName!,
      email: raw.email!,
      gender: gender!,
      experience: experience!,
      attendsAfterParty: attendsAfterParty!,
      diet: diet!,
      needsAssistance: needsAssistance!,
    });
  });

  if (lineErrors.length > 0) return { ok: false, lineErrors };
  if (guests.length === 0) return { ok: false, fileError: "Le fichier ne contient aucun invité." };
  return { ok: true, guests };
}

export type GuestImport =
  | { ok: true; rows: Array<{ line: number; data: Exclude<ReturnType<typeof guestData>, { field: string }>["data"] }> }
  | { ok: false; payload: { error: "invalid_file"; message: string } | { error: "invalid_lines"; lines: CsvLineError[] } };

/** A CSV upload read and validated into rows to store, for both import routes. */
export function prepareGuestImport(bytes: Uint8Array): GuestImport {
  const result = readGuestCsv(bytes);
  if (!result.ok) {
    return {
      ok: false,
      payload: "fileError" in result
        ? { error: "invalid_file", message: result.fileError }
        : { error: "invalid_lines", lines: result.lineErrors },
    };
  }
  const rows = [];
  const lines: CsvLineError[] = [];
  for (const guest of result.guests) {
    const parsed = guestData(guest);
    if ("field" in parsed) lines.push({ line: guest.line, message: `${parsed.field === "email" ? "e-mail" : parsed.field} invalide` });
    else rows.push({ line: guest.line, data: parsed.data });
  }
  if (lines.length > 0) return { ok: false, payload: { error: "invalid_lines", lines } };
  return { ok: true, rows };
}

/** What an import would add, flagging addresses already used at the sponsor (RG-INS-25). */
export function previewGuestImport(
  rows: Extract<GuestImport, { ok: true }>["rows"],
  existingEmails: string[],
) {
  const known = new Set(existingEmails.map((e) => e.toLowerCase()));
  return rows.map(({ line, data }) => {
    const email = data.email.toLowerCase();
    const hasDuplicateEmail = known.has(email);
    known.add(email);
    return { line, lastName: data.lastName, firstName: data.firstName, email: data.email, hasDuplicateEmail };
  });
}
