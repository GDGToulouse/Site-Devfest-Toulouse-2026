import { describe, it, expect } from "vitest";

import { FILE_REFERENCES } from "./trash-files.js";
import { FILE_ONLY_MODELS, TRASH_ENTITIES } from "./trash-registry.js";

// FILE_REFERENCES (used to reference-count a shared upload before purging it)
// is now derived from the registry's `fileFields` rather than maintained as a
// second hand-written list. This locks that derivation: the audit flagged the
// old two-list shape because forgetting to update one would delete a file still
// shown by another entity (#307).

describe("FILE_REFERENCES derivation (#307)", () => {
  it("covers exactly the registry's file fields, nothing more, nothing less", () => {
    const expected = [
      ...TRASH_ENTITIES.flatMap((e) => e.fileFields.map((f) => `${e.model}.${f}`)),
      ...FILE_ONLY_MODELS.flatMap((e) => e.fileFields.map((f) => `${e.model}.${f}`)),
    ].sort();
    const actual = FILE_REFERENCES.map((r) => `${r.model}.${r.field}`).sort();
    expect(actual).toEqual(expected);
  });

  it("still lists the known upload columns (guards against an empty registry)", () => {
    const keys = FILE_REFERENCES.map((r) => `${r.model}.${r.field}`);
    expect(keys).toContain("article.imageUrl");
    expect(keys).toContain("speaker.photoUrl");
    expect(keys).toContain("sponsor.logoUrl");
    expect(keys).toContain("edition.heroImageUrl");
  });

  // A participation is not soft-deletable, so it has no entry in the trash
  // registry and its four upload columns escaped the count entirely (#486). A
  // file used only by one was reported as unreferenced, and purging any other
  // row pointing at it erased a past edition's frozen logo (#375).
  it("counts the sponsor participation's frozen logo and com-kit files (#486)", () => {
    const keys = FILE_REFERENCES.map((r) => `${r.model}.${r.field}`);
    expect(keys).toContain("editionSponsor.logoUrl");
    expect(keys).toContain("editionSponsor.comKitLogoWebUrl");
    expect(keys).toContain("editionSponsor.comKitLogoPrintUrl");
    expect(keys).toContain("editionSponsor.comKitCharterUrl");
  });
});
