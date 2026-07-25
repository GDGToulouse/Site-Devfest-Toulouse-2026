import { describe, it, expect } from "vitest";
import { normalizeCategory } from "../lib/history-import.js";

// Coverage for the historical track mapping (#102 follow-up): every edition
// named its tracks differently, and the import has to land them all on the
// shared catalogue introduced by #338. Pure mapper — no database involved.

describe("normalizeCategory", () => {
  it("should map a 2016-2018 tag to the current catalogue", () => {
    expect(normalizeCategory({ title: "t", tags: ["Web"] })).toBe(
      "Front-end / UX / Accessibilité",
    );
    expect(normalizeCategory({ title: "t", tags: ["Cloud"] })).toBe("Infra / DevOps / Sécurité");
    expect(normalizeCategory({ title: "t", tags: ["Native mobile apps"] })).toBe(
      "Applications mobiles",
    );
  });

  it("should map the 2019 underscore-prefixed tags", () => {
    expect(normalizeCategory({ title: "t", tags: ["_big_data___ml___ai"] })).toBe(
      "IA / Machine Learning / Data",
    );
    expect(normalizeCategory({ title: "t", tags: ["_method___tools"] })).toBe(
      "Méthodes et outils de développement",
    );
  });

  it("should map the 2023-2025 WordPress terms", () => {
    expect(normalizeCategory({ title: "t", category: "Cloud / Infra / Ops" })).toBe(
      "Infra / DevOps / Sécurité",
    );
    expect(normalizeCategory({ title: "t", category: "UX / accessibilité" })).toBe(
      "Front-end / UX / Accessibilité",
    );
    expect(normalizeCategory({ title: "t", category: "WTF / autre" })).toBe(
      "Tech créative / Autres sujets",
    );
  });

  it("should accept a term already spelled like the catalogue", () => {
    expect(normalizeCategory({ title: "t", category: "Low code / No code" })).toBe(
      "Low code / No code",
    );
  });

  it("should be case and spacing insensitive", () => {
    expect(normalizeCategory({ title: "t", category: "  CLOUD / INFRA / OPS  " })).toBe(
      "Infra / DevOps / Sécurité",
    );
  });

  // The 2016 `Web` and `Méthodes et Outils` tags were catch-alls covering cloud
  // and data talks, so the file carries an explicit `category` for those. It has
  // to win, otherwise a GCP talk lands in Front-end.
  it("should prefer an explicit category over a misleading tag", () => {
    expect(
      normalizeCategory({
        title: "20 cool things about Google Cloud Platform",
        tags: ["Web"],
        category: "Infra / DevOps / Sécurité",
      }),
    ).toBe("Infra / DevOps / Sécurité");
  });

  it("should return null rather than invent a category", () => {
    expect(normalizeCategory({ title: "t" })).toBeNull();
    expect(normalizeCategory({ title: "t", tags: [] })).toBeNull();
    expect(normalizeCategory({ title: "t", category: "Quelque chose d'inconnu" })).toBeNull();
  });
});
