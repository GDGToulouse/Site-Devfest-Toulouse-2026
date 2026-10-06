import { describe, it, expect } from "vitest";

import { describeUsage } from "./file-usage";

// #483 — what a file in the media library is used by, said the way an editor
// recognises it.
describe("describeUsage (#483)", () => {
  it("should name the kind of row and the row itself", () => {
    expect(describeUsage({ model: "speaker", id: 1, label: "Marie Dupont", isTrashed: false })).toBe("Speaker · Marie Dupont");
    expect(describeUsage({ model: "editionSponsor", id: 2, label: "Acme (2025)", isTrashed: false })).toBe("Sponsor · Acme (2025)");
    expect(describeUsage({ model: "edition", id: 3, label: "2026", isTrashed: false })).toBe("Édition 2026");
  });

  it("should flag a row sitting in the trash", () => {
    expect(describeUsage({ model: "article", id: 4, label: "Bilan", isTrashed: true })).toBe("Article · Bilan (corbeille)");
  });

  it("should still say something for a kind it does not know", () => {
    expect(describeUsage({ model: "venue", id: 5, label: "Diagora", isTrashed: false })).toBe("venue · Diagora");
  });
});
