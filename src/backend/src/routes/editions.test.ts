import { describe, it, expect } from "vitest";
import { computeTicketStatus } from "./editions.js";

const NOW = new Date("2026-06-01T12:00:00Z");
const PAST = new Date("2026-05-01T00:00:00Z");
const FUTURE = new Date("2026-07-01T00:00:00Z");

describe("computeTicketStatus", () => {
  it("returns AVAILABLE when the sale window is open and nothing overrides", () => {
    expect(
      computeTicketStatus(
        { saleStartDate: PAST, saleEndDate: FUTURE, isSoldOut: false, manualStatus: null },
        NOW,
      ),
    ).toBe("AVAILABLE");
  });

  it("returns SOLD_OUT when the sale end date has passed", () => {
    expect(
      computeTicketStatus({ saleStartDate: PAST, saleEndDate: PAST }, NOW),
    ).toBe("SOLD_OUT");
  });

  it("returns COMING_SOON when the sale start date is in the future", () => {
    expect(
      computeTicketStatus({ saleStartDate: FUTURE, saleEndDate: null }, NOW),
    ).toBe("COMING_SOON");
  });

  it("uses the BilletWeb isSoldOut flag over the date window", () => {
    expect(
      computeTicketStatus(
        { saleStartDate: PAST, saleEndDate: FUTURE, isSoldOut: true },
        NOW,
      ),
    ).toBe("SOLD_OUT");
  });

  it("lets manualStatus win over both isSoldOut and the dates", () => {
    expect(
      computeTicketStatus(
        {
          saleStartDate: PAST,
          saleEndDate: PAST,
          isSoldOut: true,
          manualStatus: "AVAILABLE",
        },
        NOW,
      ),
    ).toBe("AVAILABLE");
  });

  it("ignores a null manualStatus (auto mode)", () => {
    expect(
      computeTicketStatus(
        { saleStartDate: PAST, saleEndDate: FUTURE, isSoldOut: false, manualStatus: null },
        NOW,
      ),
    ).toBe("AVAILABLE");
  });

  // #822: Billetweb sells nothing past the edition's deadline.
  it("closes every tier once the registration deadline has passed, override included", () => {
    expect(
      computeTicketStatus({ saleStartDate: PAST, saleEndDate: FUTURE, manualStatus: "AVAILABLE" }, NOW, PAST),
    ).toBe("CLOSED");
  });

  it("leaves the status alone while the deadline is ahead", () => {
    expect(
      computeTicketStatus({ saleStartDate: PAST, saleEndDate: FUTURE }, NOW, FUTURE),
    ).toBe("AVAILABLE");
  });
});
