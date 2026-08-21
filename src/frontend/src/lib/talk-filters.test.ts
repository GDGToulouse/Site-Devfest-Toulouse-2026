import { describe, it, expect } from "vitest";

import {
  EMPTY_FILTERS,
  activeFilterCount,
  matchesFilters,
  parseFilters,
  applyFiltersToParams,
  type FilterableTalk,
} from "./talk-filters";

const talk: FilterableTalk = {
  title: "Kubernetes en production",
  format: "CONFERENCE",
  level: "CONFIRME",
  language: "fr",
  category: { nameFr: "Cloud & DevOps", nameEn: "Cloud & DevOps" },
  speakers: [{ name: "Marie Dupont" }],
};

describe("session filters (#448)", () => {
  it("keeps everything when nothing is filtered", () => {
    expect(matchesFilters(talk, EMPTY_FILTERS, "fr")).toBe(true);
  });

  it("filters on each family", () => {
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, format: "QUICKIE" }, "fr")).toBe(false);
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, level: "DEBUTANT" }, "fr")).toBe(false);
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, language: "en" }, "fr")).toBe(false);
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, category: "Web & Mobile" }, "fr")).toBe(false);
  });

  it("matches a category on its localized name, the only handle the payload gives", () => {
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, category: "Cloud & DevOps" }, "fr")).toBe(true);
  });

  it("searches the title and the speakers", () => {
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, q: "kubernetes" }, "fr")).toBe(true);
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, q: "dupont" }, "fr")).toBe(true);
    expect(matchesFilters(talk, { ...EMPTY_FILTERS, q: "terraform" }, "fr")).toBe(false);
  });

  it("combines families as an AND", () => {
    const filters = { ...EMPTY_FILTERS, format: "CONFERENCE", language: "en" };
    expect(matchesFilters(talk, filters, "fr")).toBe(false);
  });

  it("counts only the families the view actually renders", () => {
    // The grid has no search field: counting `q` would send the visitor
    // hunting for a control that is not there (#256).
    const filters = { ...EMPTY_FILTERS, q: "kube", format: "CONFERENCE" };
    expect(activeFilterCount(filters, ["format", "level", "language", "category"])).toBe(1);
    expect(activeFilterCount(filters, ["q", "format", "level", "language", "category"])).toBe(2);
  });

  it("round-trips through the querystring", () => {
    const filters = { ...EMPTY_FILTERS, format: "QUICKIE", category: "Web & Mobile" };
    const params = new URLSearchParams();
    applyFiltersToParams(params, filters);

    expect(params.get("format")).toBe("QUICKIE");
    expect(params.has("level")).toBe(false);
    expect(parseFilters((key) => params.get(key) ?? undefined)).toEqual(filters);
  });
});
