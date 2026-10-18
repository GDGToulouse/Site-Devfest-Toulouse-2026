import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestContext } from "../lib/request-context.js";

// #664 — the trash was only ever emptied by an external call nobody configured.
// The purge now belongs to the backend's own scheduled tasks.

const registered = vi.hoisted(() => ({
  tasks: [] as Array<{ expression: string; run: () => Promise<void>; options: { name?: string; timezone?: string } }>,
}));

vi.mock("node-cron", () => ({
  default: {
    schedule: (expression: string, run: () => Promise<void>, options: { name?: string; timezone?: string }) => {
      registered.tasks.push({ expression, run, options });
    },
  },
}));

const purge = vi.hoisted(() => ({
  contexts: [] as Array<RequestContext | undefined>,
  failWith: null as Error | null,
}));

vi.mock("../lib/trash-purge.js", async () => {
  const { getRequestContext } = await import("../lib/request-context.js");
  return {
    purgeExpiredTrash: async () => {
      purge.contexts.push(getRequestContext());
      await Promise.resolve();
      if (purge.failWith) throw purge.failWith;
      return { cutoff: "2026-01-01T00:00:00.000Z", retentionDays: 30, entities: [], totalPurged: 4 };
    },
  };
});

const { startScheduledTasks } = await import("../lib/scheduler.js");

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function trashTask() {
  startScheduledTasks(log as never);
  return registered.tasks.find((t) => t.options.name === "trash-purge");
}

beforeEach(() => {
  registered.tasks.length = 0;
  purge.contexts.length = 0;
  purge.failWith = null;
  vi.clearAllMocks();
});

describe("scheduled trash purge (#664)", () => {
  it("should schedule the purge once a day, on Paris time", () => {
    const task = trashTask();

    expect(task?.expression).toBe("0 4 * * *");
    expect(task?.options.timezone).toBe("Europe/Paris");
  });

  it("should purge as the system, so the history names the scheduled task", async () => {
    await trashTask()?.run();

    expect(purge.contexts).toHaveLength(1);
    expect(purge.contexts[0]).toMatchObject({ channel: "SYSTEM", actor: { userId: null, label: "Purge de la corbeille" } });
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ purged: 4 }), "Trash purged");
  });

  it("should log a failing purge instead of taking the server down", async () => {
    purge.failWith = new Error("database is gone");

    await expect(trashTask()?.run()).resolves.toBeUndefined();

    expect(log.error).toHaveBeenCalledWith(expect.objectContaining({ err: purge.failWith }), "Trash purge failed");
  });
});
