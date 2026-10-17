import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { FILE_REFERENCES, purgeFiles } from "./trash-files.js";
import { UPLOADS_DIR } from "./image-store.js";
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

// A speaker or a sponsor sets their own image URL. Read through its basename,
// `/uploads/anything/<someone-else's file>` pointed at another file, which no
// exact reference count protected: a purge deleted a file still in use (#658).
describe("purgeFiles — only a plain /uploads/<file> URL is a file of ours", () => {
  it("should leave alone a file reached through a nested path", async () => {
    const name = `purge-guard-${Date.now()}.png`;
    const file = path.join(UPLOADS_DIR, name);
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(file, "x");

    const [outcome] = await purgeFiles([`/uploads/anything/${name}`], { model: "speaker", id: -1 });

    expect(outcome.deleted).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
    await fs.promises.unlink(file);
  });
});
