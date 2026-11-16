import { describe, it, expect } from "vitest";

import { oneAtATime } from "./one-at-a-time.js";

// #849: badge PDFs are generated one at a time.

const later = <T>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe("oneAtATime", () => {
  it("should start a job only once the previous one is done", async () => {
    const queue = oneAtATime();
    const order: string[] = [];

    await Promise.all([
      queue(async () => {
        order.push("first:start");
        await later(null, 20);
        order.push("first:end");
      }),
      queue(async () => {
        order.push("second:start");
      }),
    ]);

    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("should run the next job after one that failed", async () => {
    const queue = oneAtATime();

    const failed = queue(async () => {
      throw new Error("boom");
    });
    const next = queue(async () => "done");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("done");
  });
});
