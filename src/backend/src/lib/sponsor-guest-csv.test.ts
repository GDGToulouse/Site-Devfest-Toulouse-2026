import { describe, it, expect } from "vitest";

import { decodeCsv, detectSeparator, guestCsvTemplate, parseCsv, prepareGuestImport, readGuestCsv } from "./sponsor-guest-csv.js";

// #729 — the files sponsors actually send: Excel on Windows (Windows-1252, `;`),
// Google Sheets and LibreOffice (UTF-8, `,`), quoted or not.

const HEADER = "Nom;Prénom;E-mail;Genre;Expérience professionnelle;After;Régime;Assistance";

function utf8(text: string) {
  return new TextEncoder().encode(text);
}

// What Excel writes for "CSV (séparateur : point-virgule)" on a French Windows.
function windows1252(text: string) {
  return Uint8Array.from([...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code > 0xff) throw new Error(`not in Latin-1: ${ch}`);
    return code;
  }));
}

describe("decodeCsv (RG-INS-31)", () => {
  it("should read UTF-8 and drop the BOM", () => {
    expect(decodeCsv(utf8("﻿Prénom"))).toBe("Prénom");
  });

  it("should fall back to Windows-1252 when the bytes are not UTF-8", () => {
    expect(decodeCsv(windows1252("Prénom;Hélène"))).toBe("Prénom;Hélène");
  });
});

describe("parseCsv", () => {
  it("should keep a separator and doubled quotes inside a quoted value", () => {
    expect(parseCsv('"Dupont; fils";"dit ""Jo"""\r\nA;B', ";")).toEqual([
      ["Dupont; fils", 'dit "Jo"'],
      ["A", "B"],
    ]);
  });

  it("should detect a comma-separated header", () => {
    expect(detectSeparator("Nom,Prénom,E-mail\nA,B,C")).toBe(",");
    expect(detectSeparator('"Nom, complet";Prénom;E-mail')).toBe(";");
  });
});

describe("readGuestCsv (RG-INS-32, RG-INS-33)", () => {
  it("should read a Windows-1252 Excel export with its accents", () => {
    const result = readGuestCsv(windows1252(`${HEADER}\r\nLefèvre;Hélène;helene@example.org;Femme;Sup à 7 ans;x;Végétarien;\r\n`));

    expect(result).toEqual({
      ok: true,
      guests: [
        {
          line: 2,
          lastName: "Lefèvre",
          firstName: "Hélène",
          email: "helene@example.org",
          gender: "FEMALE",
          experience: "OVER_7_YEARS",
          attendsAfterParty: true,
          diet: "VEGETARIAN",
          needsAssistance: false,
        },
      ],
    });
  });

  it("should read a quoted comma-separated UTF-8 file in another column order", () => {
    const csv = '"E-mail","Nom","Prénom","Genre","Expérience"\n"bob@example.org","Martin","Bob","homme","moins de 3 ans"\n';
    const result = readGuestCsv(utf8(csv));

    expect(result.ok && result.guests[0]).toMatchObject({
      lastName: "Martin",
      firstName: "Bob",
      email: "bob@example.org",
      gender: "MALE",
      experience: "UNDER_3_YEARS",
      attendsAfterParty: false,
      diet: "NONE",
    });
  });

  it("should list every faulty line rather than stop at the first", () => {
    const csv = `${HEADER}\nA;B;a@example.org;Femme;Etudiant;oui;;non\nC;;c@example.org;Robot;Etudiant;peut-être;;\n;E;e@example.org;Homme;Etudiant;;;\n`;
    const result = readGuestCsv(utf8(csv));

    expect(result.ok).toBe(false);
    expect(!result.ok && "lineErrors" in result && result.lineErrors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("should refuse a file missing a required column, and name it", () => {
    const result = readGuestCsv(utf8("Nom;Prénom;Genre;Expérience\nA;B;Femme;Etudiant\n"));
    expect(result).toEqual({ ok: false, fileError: "Colonne manquante : E-mail." });
  });

  it("should skip blank lines, as a spreadsheet leaves them at the end", () => {
    const result = readGuestCsv(utf8(`${HEADER}\nA;B;a@example.org;Femme;Etudiant;non;;non\n;;;;;;;\n\n`));
    expect(result.ok && result.guests).toHaveLength(1);
  });

  it("should refuse an address that cannot be one", () => {
    const result = prepareGuestImport(utf8(`${HEADER}\nA;B;pas-une-adresse;Femme;Etudiant;non;;non\n`));
    expect(result).toEqual({ ok: false, payload: { error: "invalid_lines", lines: [{ line: 2, message: "e-mail invalide" }] } });
  });
});

describe("guestCsvTemplate (RG-INS-30)", () => {
  it("should read back its own example line", () => {
    const template = guestCsvTemplate();
    expect(template.startsWith("﻿Nom;Prénom;E-mail;Genre (Femme / Homme / Non spécifié);")).toBe(true);

    const result = readGuestCsv(utf8(template));
    expect(result.ok && result.guests[0]).toMatchObject({ lastName: "Dupont", experience: "FROM_3_TO_7_YEARS", attendsAfterParty: true });
  });
});
