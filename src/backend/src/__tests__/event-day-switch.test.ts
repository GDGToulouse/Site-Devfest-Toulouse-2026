import { describe, it, expect, afterEach, vi } from "vitest";

// #585 — at midnight on its first day, an edition of the last stretch goes to
// "Jour J" by itself; one not ready for it never does.

const revalidateAll = vi.fn(async () => ({ ok: true }));
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: () => revalidateAll(),
}));

const { prisma } = await import("../lib/prisma.js");
const { switchToEventDay, parisDay } = await import("../lib/event-day-switch.js");
const { runInContext, systemContext } = await import("../lib/request-context.js");

// Years no other test file uses (#292). Each test gets its own: the switch
// looks at every edition, and a shared one would be switched by a neighbour.
const created: number[] = [];

afterEach(async () => {
  revalidateAll.mockClear();
  await prisma.auditLog.deleteMany({ where: { entity: "Edition", entityId: { in: created.map(String) } } });
  await prisma.edition.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

async function edition(year: number, status: "TICKETING" | "PROGRAMME" | "ANNOUNCEMENT", startDate: string) {
  const row = await prisma.edition.create({ data: { year, status, startDate: new Date(`${startDate}T00:00:00Z`) } });
  created.push(row.id);
  return row;
}

const statusOf = async (id: number) => (await prisma.edition.findUniqueOrThrow({ where: { id } })).status;

describe("switchToEventDay (#585)", () => {
  it("should switch the last week to Jour J just after midnight in Toulouse, and purge the site", async () => {
    const e = await edition(1966, "PROGRAMME", "1966-11-19");

    // 00:05 in Toulouse, still the 18th in UTC.
    const switched = await switchToEventDay(new Date("1966-11-18T23:05:00Z"));

    expect(switched).toEqual([{ id: e.id, year: 1966 }]);
    expect(await statusOf(e.id)).toBe("EVENT_DAY");
    expect(revalidateAll).toHaveBeenCalledTimes(1);
  });

  it("should switch the last month too", async () => {
    const e = await edition(1967, "TICKETING", "1967-11-19");

    await switchToEventDay(new Date("1967-11-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("EVENT_DAY");
  });

  it("should leave an edition that is not ready for it", async () => {
    const e = await edition(1968, "ANNOUNCEMENT", "1968-11-19");

    await switchToEventDay(new Date("1968-11-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("ANNOUNCEMENT");
    expect(revalidateAll).not.toHaveBeenCalled();
  });

  it("should wait for the day itself", async () => {
    const e = await edition(1969, "PROGRAMME", "1969-11-19");

    // 23:55 in Toulouse on the eve.
    await switchToEventDay(new Date("1969-11-18T22:55:00Z"));

    expect(await statusOf(e.id)).toBe("PROGRAMME");
  });

  it("should file the switch as the system's doing", async () => {
    const e = await edition(1970, "PROGRAMME", "1970-11-19");

    await runInContext(systemContext("Passage automatique en Jour J"), () => switchToEventDay(new Date("1970-11-19T08:00:00Z")));

    const log = await prisma.auditLog.findFirst({ where: { entity: "Edition", entityId: String(e.id), action: "UPDATE" } });
    expect(log).toMatchObject({ channel: "SYSTEM" });
  });
});

describe("parisDay (#585)", () => {
  it("should read the Toulouse calendar day, not the UTC one", () => {
    expect(parisDay(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
  });
});
