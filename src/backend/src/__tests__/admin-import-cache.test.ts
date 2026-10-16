import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// #627 — after a Sessionize import, each speaker's and each talk's own page
// stayed stale for an hour: only the lists were purged. The import now purges
// the whole site and says so when it could not. The Sessionize fetch and the
// purge are stubbed; the import itself runs for real on an empty export.
const { loadMock, revalidateAllMock } = vi.hoisted(() => ({ loadMock: vi.fn(), revalidateAllMock: vi.fn() }));
vi.mock("../lib/sessionize-import.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/sessionize-import.js")>()),
  loadSessionizeData: loadMock,
}));
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: revalidateAllMock,
}));

import Fastify, { type FastifyInstance } from "fastify";
import adminImportRoutes from "../routes/admin/import.js";
import adminCacheRoutes from "../routes/admin/cache.js";
import { prisma } from "../lib/prisma.js";

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1992;
const EMPTY_EXPORT = { sessions: [], speakers: [], categories: [], rooms: [], questions: [] };

let app: FastifyInstance;
let editionId: number;

const runImport = () =>
  app.inject({ method: "POST", url: "/api/admin/import/sessionize", payload: { editionId, json: JSON.stringify(EMPTY_EXPORT) } });

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminImportRoutes, { prefix: "/api/admin" });
  await app.register(adminCacheRoutes, { prefix: "/api/admin" });
  await app.ready();
  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
});

afterAll(async () => {
  await app.close();
  await prisma.edition.delete({ where: { id: editionId } });
});

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue(EMPTY_EXPORT);
  revalidateAllMock.mockReset();
});

describe("Sessionize import and the site cache (#627)", () => {
  it("should purge the whole site once the import is written", async () => {
    revalidateAllMock.mockResolvedValue({ ok: true });

    const res = await runImport();

    expect(res.statusCode).toBe(200);
    expect(revalidateAllMock).toHaveBeenCalledTimes(1);
    expect(res.json().warnings.join(" ")).not.toContain("cache");
  });

  it("should say in the report when the purge failed, without failing the import", async () => {
    revalidateAllMock.mockResolvedValue({ ok: false, reason: "HTTP 503" });

    const res = await runImport();

    expect(res.statusCode).toBe(200);
    expect(res.json().warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Le cache du site n'a pas pu être vidé (HTTP 503)")]),
    );
  });
});

describe("Purge everything from the Cache tab (#627)", () => {
  it("should purge the whole site, not a handful of pages", async () => {
    revalidateAllMock.mockResolvedValue({ ok: true });

    const res = await app.inject({ method: "POST", url: "/api/admin/cache/purge", payload: { all: true } });

    expect(res.statusCode).toBe(200);
    expect(revalidateAllMock).toHaveBeenCalledTimes(1);
  });

  it("should report a purge that failed instead of announcing it done", async () => {
    revalidateAllMock.mockResolvedValue({ ok: false, reason: "REVALIDATE_SECRET absent" });

    const res = await app.inject({ method: "POST", url: "/api/admin/cache/purge", payload: { all: true } });

    expect(res.statusCode).toBe(502);
    expect(res.json().message).toContain("REVALIDATE_SECRET absent");
  });
});
