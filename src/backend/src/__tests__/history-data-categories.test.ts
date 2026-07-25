import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { normalizeCategory, type HistoryData } from "../lib/history-import.js";

// Guards the data file the production import reads (#102 follow-up). The
// categories were recovered from the archived edition sites, so a typo here
// would silently leave talks uncategorised on the public replay filters.

const here = dirname(fileURLToPath(import.meta.url));
const history = JSON.parse(
  readFileSync(resolve(here, "../../prisma/devfest-history.json"), "utf8"),
) as HistoryData;

// The curated catalogue, as seeded for 2026. The import never creates a
// category, so anything outside this list would be dropped with a warning.
const CATALOGUE = new Set([
  "Applications mobiles",
  "Dev assisté par IA",
  "Developer Experience",
  "Front-end / UX / Accessibilité",
  "IA / Machine Learning / Data",
  "Infra / DevOps / Sécurité",
  "Internet des objets / Systèmes embarqués",
  "Langages de programmation",
  "Low code / No code",
  "Méthodes et outils de développement",
  "Tech créative / Autres sujets",
]);

const sessions = Object.entries(history.editions).flatMap(([year, ed]) =>
  (ed.sessions ?? []).map((s) => ({ year, session: s })),
);

describe("devfest-history.json categories", () => {
  it("should resolve a category for every session", () => {
    const orphans = sessions
      .filter(({ session }) => normalizeCategory(session) === null)
      .map(({ year, session }) => `${year}: ${session.title}`);

    expect(orphans).toEqual([]);
  });

  it("should only resolve to categories present in the catalogue", () => {
    const unknown = [
      ...new Set(
        sessions
          .map(({ session }) => normalizeCategory(session))
          .filter((c): c is string => c !== null && !CATALOGUE.has(c)),
      ),
    ];

    expect(unknown).toEqual([]);
  });
});
