import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { assertScoped } from "./support/guard-unscoped-writes.js";

// #681 — a cleanup whose id is still `undefined` (its beforeAll threw) must not
// turn into "delete everything". The guard is loaded for every test file, so
// these run against the same client as the suites.

const stamp = `guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tagName = `Guard ${stamp}`;
let tagId: number | undefined;

afterAll(async () => {
  if (tagId !== undefined) await prisma.fileTag.deleteMany({ where: { id: tagId } });
});

describe("unscoped bulk writes in tests (#681)", () => {
  it("should refuse a deleteMany whose filter value is undefined, and delete nothing", async () => {
    const tag = await prisma.fileTag.create({ data: { name: tagName, slug: stamp } });
    tagId = tag.id;
    const unset: number | undefined = undefined;

    const attempt = prisma.fileTag.deleteMany({ where: { id: unset } });

    await expect(attempt).rejects.toThrow(/undefined value in its filter/);
    expect(await prisma.fileTag.findUnique({ where: { id: tag.id } })).not.toBeNull();
  });

  it("should refuse an updateMany whose nested filter holds an undefined value", async () => {
    const unset: string | undefined = undefined;

    const attempt = prisma.fileTag.updateMany({ where: { files: { some: { filename: unset } } }, data: { name: tagName } });

    await expect(attempt).rejects.toThrow(/undefined value in its filter/);
  });

  it("should refuse a bulk write without any filter", () => {
    expect(() => assertScoped("Talk", "deleteMany", {})).toThrow(/without a filter/);
    expect(() => assertScoped("Talk", "deleteMany", undefined)).toThrow(/without a filter/);
  });

  it("should let a filter with real values through, including null and empty lists", () => {
    expect(() => assertScoped("Talk", "deleteMany", { editionId: 4, deletedAt: null, id: { in: [] } })).not.toThrow();
  });
});
