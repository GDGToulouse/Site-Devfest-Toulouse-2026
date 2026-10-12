import { describe, it, expect, afterEach, vi } from "vitest";

// #585 — the last stretch moves on by itself at midnight on each trigger day:
// a month before, a week before, the day. Forward only, from an announced
// edition at least, and on the trigger day only, so a status moved back by
// hand stays where the team put it.

const revalidateAll = vi.fn(async () => ({ ok: true }));
vi.mock("../lib/revalidate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/revalidate.js")>()),
  revalidateAll: () => revalidateAll(),
}));

const { prisma } = await import("../lib/prisma.js");
const { applyScheduledStatus, parisDay, switchDays } = await import("../lib/edition-status-schedule.js");
const { runInContext, systemContext } = await import("../lib/request-context.js");

// Years no other test file uses (#292), one per test: the switch looks at
// every edition, and a shared one would be switched by a neighbour.
const created: number[] = [];

afterEach(async () => {
  revalidateAll.mockClear();
  await prisma.auditLog.deleteMany({ where: { entity: "Edition", entityId: { in: created.map(String) } } });
  await prisma.edition.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

type Status = "PREPARATION" | "ANNOUNCEMENT" | "TICKETING" | "PROGRAMME";

async function edition(year: number, status: Status) {
  const row = await prisma.edition.create({ data: { year, status, startDate: new Date(`${year}-11-19T00:00:00Z`) } });
  created.push(row.id);
  return row;
}

const statusOf = async (id: number) => (await prisma.edition.findUniqueOrThrow({ where: { id } })).status;

describe("applyScheduledStatus (#585)", () => {
  it("should open the ticket office a month before, at midnight in Toulouse", async () => {
    const e = await edition(1960, "ANNOUNCEMENT");

    // 00:05 on October 19 in Toulouse, still the 18th in UTC.
    const switched = await applyScheduledStatus(new Date("1960-10-18T23:05:00Z"));

    expect(switched).toEqual([{ id: e.id, year: 1960, status: "TICKETING" }]);
    expect(revalidateAll).toHaveBeenCalledTimes(1);
  });

  it("should move to the last week a week before", async () => {
    const e = await edition(1961, "TICKETING");

    await applyScheduledStatus(new Date("1961-11-12T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("PROGRAMME");
  });

  it("should move to Jour J on the day", async () => {
    const e = await edition(1962, "PROGRAMME");

    await applyScheduledStatus(new Date("1962-11-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("EVENT_DAY");
  });

  it("should reach Jour J from the last month too, if the last week was skipped", async () => {
    const e = await edition(1963, "TICKETING");

    await applyScheduledStatus(new Date("1963-11-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("EVENT_DAY");
  });

  it("should leave an edition still in preparation", async () => {
    const e = await edition(1964, "PREPARATION");

    await applyScheduledStatus(new Date("1964-11-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("PREPARATION");
    expect(revalidateAll).not.toHaveBeenCalled();
  });

  it("should never move back an edition already further on", async () => {
    // Switched to the last week by hand before the month mark came.
    const e = await edition(1965, "PROGRAMME");

    await applyScheduledStatus(new Date("1965-10-19T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("PROGRAMME");
  });

  it("should do nothing outside the trigger days, so a status moved back by hand stays", async () => {
    // Back to the last month by hand, the day after the week mark.
    const e = await edition(1966, "TICKETING");

    await applyScheduledStatus(new Date("1966-11-13T08:00:00Z"));

    expect(await statusOf(e.id)).toBe("TICKETING");
  });

  it("should file the switch as the system's doing", async () => {
    const e = await edition(1967, "PROGRAMME");

    await runInContext(systemContext("Changement de statut programmé"), () => applyScheduledStatus(new Date("1967-11-19T08:00:00Z")));

    const log = await prisma.auditLog.findFirst({ where: { entity: "Edition", entityId: String(e.id), action: "UPDATE" } });
    expect(log).toMatchObject({ channel: "SYSTEM" });
  });
});

describe("switchDays (#585)", () => {
  it("should place the switches a month, a week and zero days before the first day", () => {
    expect(switchDays(new Date("2026-11-19T00:00:00Z"))).toEqual([
      { status: "TICKETING", day: "2026-10-19" },
      { status: "PROGRAMME", day: "2026-11-12" },
      { status: "EVENT_DAY", day: "2026-11-19" },
    ]);
  });

  it("should fall on the last day of a shorter month", () => {
    expect(switchDays(new Date("2026-03-31T00:00:00Z"))[0]).toEqual({ status: "TICKETING", day: "2026-02-28" });
  });

  it("should read the Toulouse calendar day, not the UTC one", () => {
    expect(parisDay(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
  });
});
