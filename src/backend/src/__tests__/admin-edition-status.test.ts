import { describe, it, expect, afterEach, vi } from "vitest";

// #576 — the "last month" status: stored, served to the public site, and a
// change of status purges every page, since the header carries the sponsor call.

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => ({
    user: { id: "test-admin", email: "admin@test.local", name: "Test", role: "ADMIN" },
  }),
}));

const revalidateAll = vi.fn(async () => ({ ok: true }));
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: () => revalidateAll(),
}));

const { buildAdminApp } = await import("./test-admin-app.js");
const { prisma } = await import("../lib/prisma.js");

// Below the seeded range (2016+, #292), unused by the other edition tests.
const YEAR = 1852;
const createdEditionIds: number[] = [];

afterEach(async () => {
  revalidateAll.mockClear();
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

async function createEdition() {
  const edition = await prisma.edition.create({ data: { year: YEAR, status: "ANNOUNCEMENT" } });
  createdEditionIds.push(edition.id);
  return edition;
}

describe("Edition status TICKETING (#576)", () => {
  it("should store the status and purge every page when it changes", async () => {
    const edition = await createEdition();
    const app = await buildAdminApp();

    const res = await app.inject({ method: "PUT", url: `/api/admin/editions/${edition.id}`, payload: { status: "TICKETING" } });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect((await prisma.edition.findUniqueOrThrow({ where: { id: edition.id } })).status).toBe("TICKETING");
    expect(revalidateAll).toHaveBeenCalledTimes(1);
  });

  it("should store the last-week and event-day statuses (#577)", async () => {
    const edition = await createEdition();
    const app = await buildAdminApp();

    for (const status of ["PROGRAMME", "EVENT_DAY"]) {
      const res = await app.inject({ method: "PUT", url: `/api/admin/editions/${edition.id}`, payload: { status } });
      expect(res.statusCode).toBe(200);
      expect((await prisma.edition.findUniqueOrThrow({ where: { id: edition.id } })).status).toBe(status);
    }
    await app.close();
  });

  it("should not purge every page when the status stays the same", async () => {
    const edition = await createEdition();
    const app = await buildAdminApp();

    await app.inject({ method: "PUT", url: `/api/admin/editions/${edition.id}`, payload: { status: "ANNOUNCEMENT" } });
    await app.close();

    expect(revalidateAll).not.toHaveBeenCalled();
  });
});
