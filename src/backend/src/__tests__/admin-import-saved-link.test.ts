import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// #529 — once an import from the Sessionize API link succeeds, the edition
// keeps the link, so the next import needs no pasting. The Sessionize fetch is
// stubbed (its SSRF guard resolves DNS): what is under test is which link the
// route hands it, and when it keeps one. The import itself runs for real on an
// empty export.
const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn() }));
vi.mock("../lib/sessionize-import.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/sessionize-import.js")>()),
  loadSessionizeData: loadMock,
}));

// Removing the link is ADMIN-only (decision of 2026-10-06): the caller is
// stubbed, as an ADMIN unless a test says otherwise.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-admin", email: "admin@test.local", name: "Ad", role: "ADMIN" } },
}));
vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

import Fastify, { type FastifyInstance } from "fastify";
import adminImportRoutes from "../routes/admin/import.js";
import { prisma } from "../lib/prisma.js";

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1993;
const LINK = "https://sessionize.com/api/v2/test529/view/All";
const EMPTY_EXPORT = { sessions: [], speakers: [], categories: [], rooms: [], questions: [] };

let app: FastifyInstance;
let editionId: number;

const storedLink = async () =>
  (await prisma.edition.findUnique({ where: { id: editionId }, select: { sessionizeApiUrl: true } }))?.sessionizeApiUrl;

function importWith(payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/api/admin/import/sessionize", payload: { editionId, ...payload } });
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminImportRoutes, { prefix: "/api/admin" });
  await app.ready();
  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
});

afterAll(async () => {
  await app.close();
  await prisma.edition.delete({ where: { id: editionId } });
});

beforeEach(async () => {
  loadMock.mockReset();
  loadMock.mockResolvedValue(EMPTY_EXPORT);
  await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: null } });
});

describe("Saved Sessionize import link (#529)", () => {
  it("should keep the link of a successful import, and read it back", async () => {
    const res = await importWith({ url: LINK });
    const source = await app.inject({ method: "GET", url: `/api/admin/import/sessionize/${editionId}/source` });

    expect(res.statusCode).toBe(200);
    expect(await storedLink()).toBe(LINK);
    expect(source.json()).toEqual({ url: LINK });
  });

  it("should re-import from the saved link when none is given", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: LINK } });

    const res = await importWith({});

    expect(res.statusCode).toBe(200);
    expect(loadMock).toHaveBeenCalledWith({ url: LINK, json: undefined });
  });

  it("should answer 400 in French when no link is saved and none is given", async () => {
    const res = await importWith({});

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Aucun lien Sessionize enregistré pour cette édition.");
  });

  it("should not keep a link whose import failed", async () => {
    loadMock.mockRejectedValue(new Error("Sessionize fetch failed: HTTP 404"));

    const res = await importWith({ url: LINK });

    expect(res.statusCode).toBe(422);
    expect(await storedLink()).toBeNull();
  });

  it("should leave the saved link alone on a pasted JSON import", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: LINK } });

    const res = await importWith({ json: JSON.stringify(EMPTY_EXPORT) });

    expect(res.statusCode).toBe(200);
    expect(await storedLink()).toBe(LINK);
  });

  it("should answer 400, not 500, on a malformed body", async () => {
    const noEdition = await app.inject({ method: "POST", url: "/api/admin/import/sessionize", payload: { url: LINK } });
    const urlNotText = await importWith({ url: 42 });

    expect(noEdition.statusCode).toBe(400);
    expect(urlNotText.statusCode).toBe(400);
  });

  it("should let an ADMIN remove the link", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: LINK } });

    const res = await app.inject({ method: "DELETE", url: `/api/admin/import/sessionize/${editionId}/source` });

    expect(res.statusCode).toBe(204);
    expect(await storedLink()).toBeNull();
  });

  it("should refuse an EDITOR removing the link", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: LINK } });
    const asAdmin = authContext.current;
    authContext.current = { user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" } };

    try {
      const res = await app.inject({ method: "DELETE", url: `/api/admin/import/sessionize/${editionId}/source` });

      expect(res.statusCode).toBe(403);
      expect(await storedLink()).toBe(LINK);
    } finally {
      authContext.current = asAdmin;
    }
  });

  it("should 404 on the link of an unknown edition", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/import/sessionize/99999999/source" });

    expect(res.statusCode).toBe(404);
  });
});
