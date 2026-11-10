import { describe, it, expect } from "vitest";
import { findSalesEnd, readBilletwebDate } from "./ticket-sales-end.js";

describe("readBilletwebDate", () => {
  it("should read a Unix timestamp in seconds", () => {
    expect(readBilletwebDate("1795387500")?.toISOString()).toBe("2026-11-22T22:45:00.000Z");
  });

  it("should read Billetweb's wall-clock format as Paris time", () => {
    expect(readBilletwebDate("2026-11-16 23:55:00")?.toISOString()).toBe("2026-11-16T22:55:00.000Z");
  });

  it("should return null for an empty or non-date value", () => {
    expect(readBilletwebDate("")).toBeNull();
    expect(readBilletwebDate("0")).toBeNull();
    expect(readBilletwebDate("Paris")).toBeNull();
    expect(readBilletwebDate(undefined)).toBeNull();
  });

  it("should not read a slug or a URL ending in a year as a date", () => {
    expect(readBilletwebDate("devfest-toulouse-2026")).toBeNull();
    expect(readBilletwebDate("https://www.billetweb.fr/shop.php?event=devfest-toulouse-2026")).toBeNull();
  });

  it("should not read a rate or a quota as a date", () => {
    expect(readBilletwebDate("20")).toBeNull();
    expect(readBilletwebDate(20)).toBeNull();
    expect(readBilletwebDate("1401706")).toBeNull();
  });
});

describe("findSalesEnd", () => {
  it("should take the sales end from a field that names it", () => {
    const result = findSalesEnd({
      id: "1401706",
      start: "2026-11-19 08:00:00",
      end: "2026-11-19 19:00:00",
      sales_end: "2026-11-16 23:55:00",
    });
    expect(result.salesEndAt?.toISOString()).toBe("2026-11-16T22:55:00.000Z");
    expect(result.field).toBe("sales_end");
  });

  it("should never mistake the event's own end for the deadline", () => {
    const result = findSalesEnd({ start: "2026-11-19 08:00:00", end: "2026-11-19 19:00:00" });
    expect(result.salesEndAt).toBeNull();
    expect(result.dateFields).toEqual({
      start: "2026-11-19T07:00:00.000Z",
      end: "2026-11-19T18:00:00.000Z",
    });
  });

  it("should find nothing on a missing event", () => {
    expect(findSalesEnd(undefined)).toEqual({ salesEndAt: null, field: null, dateFields: {} });
  });
});
