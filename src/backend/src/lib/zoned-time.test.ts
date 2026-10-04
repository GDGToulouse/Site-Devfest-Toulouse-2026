import { describe, it, expect } from "vitest";
import { parseWallTime } from "./zoned-time.js";

describe("parseWallTime (#519)", () => {
  it("should read a November Sessionize time as Paris winter time", () => {
    expect(parseWallTime("2026-11-19T09:50:00")?.toISOString()).toBe("2026-11-19T08:50:00.000Z");
  });

  it("should read a summer time with the summer offset", () => {
    expect(parseWallTime("2026-06-18T09:50:00")?.toISOString()).toBe("2026-06-18T07:50:00.000Z");
  });

  it("should land on the right side of the October clock change", () => {
    expect(parseWallTime("2026-10-25T01:30:00")?.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(parseWallTime("2026-10-25T04:00:00")?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("should accept a time without seconds", () => {
    expect(parseWallTime("2026-11-19T17:00")?.toISOString()).toBe("2026-11-19T16:00:00.000Z");
  });

  it("should keep a time that already carries an offset", () => {
    expect(parseWallTime("2026-11-19T09:50:00Z")?.toISOString()).toBe("2026-11-19T09:50:00.000Z");
    expect(parseWallTime("2026-11-19T09:50:00+01:00")?.toISOString()).toBe("2026-11-19T08:50:00.000Z");
  });

  it("should return null for nothing or for something that is not a date-time", () => {
    expect(parseWallTime(null)).toBeNull();
    expect(parseWallTime("")).toBeNull();
    expect(parseWallTime("demain matin")).toBeNull();
  });
});
