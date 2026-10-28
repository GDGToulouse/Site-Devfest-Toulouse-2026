import { describe, it, expect } from "vitest";
import { planAttendeeImport, toImportedAttendee, type ImportedAttendee } from "./attendees.js";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "101",
    barcode: "9001",
    firstname: "Léa",
    name: "Martin",
    email: "lea@example.com",
    ticket_id: "t1",
    category: "",
    order_id: "o1",
    order_date: "2026-09-01 10:00:00",
    disabled: "0",
    custom: {},
    custom_order: {},
    ...overrides,
  };
}

function imported(overrides: Partial<ImportedAttendee> = {}): ImportedAttendee {
  return { ...(toImportedAttendee(row()) as ImportedAttendee), ...overrides };
}

describe("toImportedAttendee (#638)", () => {
  it("reads the order date as Paris wall time", () => {
    expect(toImportedAttendee(row())?.orderDate.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("marks a refunded or cancelled ticket as cancelled", () => {
    expect(toImportedAttendee(row({ disabled: "1" }))?.isCancelled).toBe(true);
  });

  it("marks a deleted order's ticket as cancelled, which Billetweb reports as 2", () => {
    expect(toImportedAttendee(row({ disabled: "2" }))?.isCancelled).toBe(true);
  });

  it("finds the company in a custom field, whatever the organiser named it", () => {
    expect(toImportedAttendee(row({ custom: { "Nom de votre société": "Acme" } }))?.company).toBe("Acme");
    expect(toImportedAttendee(row({ custom_order: { Entreprise: " Initech " } }))?.company).toBe("Initech");
    expect(toImportedAttendee(row({ custom: { "T-shirt": "M" } }))?.company).toBeNull();
  });

  it("skips a row it cannot key", () => {
    expect(toImportedAttendee(row({ id: "" }))).toBeNull();
    expect(toImportedAttendee(row({ order_date: "" }))).toBeNull();
  });
});

describe("planAttendeeImport (#638)", () => {
  const tiers = new Map([["t1", 7]]);

  it("creates a new ticket, linked to its tier", () => {
    const plan = planAttendeeImport([], [imported()], tiers);
    expect(plan.creates).toEqual([expect.objectContaining({ billetwebId: "101", ticketTierId: 7 })]);
  });

  it("writes nothing when Billetweb has nothing new", () => {
    const plan = planAttendeeImport([{ ...imported(), id: 1, ticketTierId: 7 }], [imported()], tiers);
    expect(plan).toEqual({ creates: [], updates: [], cancelled: 0, unchanged: 1 });
  });

  it("updates only the fields that moved", () => {
    const plan = planAttendeeImport(
      [{ ...imported(), id: 1, ticketTierId: 7 }],
      [imported({ lastName: "Martin-Durand" })],
      tiers,
    );
    expect(plan.updates).toEqual([{ id: 1, data: { lastName: "Martin-Durand" } }]);
  });

  it("counts a ticket newly refunded, and keeps it", () => {
    const plan = planAttendeeImport(
      [{ ...imported(), id: 1, ticketTierId: 7 }],
      [imported({ isCancelled: true })],
      tiers,
    );
    expect(plan.cancelled).toBe(1);
    expect(plan.updates).toEqual([{ id: 1, data: { isCancelled: true } }]);
  });

  it("leaves the tier empty when it is not imported yet", () => {
    const plan = planAttendeeImport([], [imported({ billetwebTicketId: "t9" })], tiers);
    expect(plan.creates[0].ticketTierId).toBeNull();
  });
});
