import { describe, it, expect } from "vitest";

import { findRoomClash, type RoomOccupation } from "./room-clash.js";

// The rule the seed enforces (#462). Two quickies following each other in a
// room is the nominal 2026 shape; only a real overlap is a mistake.

function at(roomId: number, slug: string, start: string, end: string): RoomOccupation {
  return {
    slug,
    room: `Salle ${roomId}`,
    roomId,
    start: new Date(`2026-11-19T${start}:00Z`),
    end: new Date(`2026-11-19T${end}:00Z`),
  };
}

describe("two sessions in one room", () => {
  it("accepts them back to back", () => {
    // Exactly what a pair of quickies looks like inside a 40-minute slot.
    const clash = findRoomClash([
      at(1, "quickie-a", "10:55", "11:15"),
      at(1, "quickie-b", "11:15", "11:35"),
    ]);

    expect(clash).toBeNull();
  });

  it("rejects them overlapping", () => {
    const clash = findRoomClash([
      at(1, "conference", "10:55", "11:35"),
      at(1, "autre-conference", "10:55", "11:35"),
    ]);

    expect(clash).not.toBeNull();
    expect(clash?.current.slug).toBe("autre-conference");
  });

  it("rejects a session that runs into the next one", () => {
    const clash = findRoomClash([
      at(1, "trop-longue", "10:55", "11:20"),
      at(1, "la-suivante", "11:15", "11:35"),
    ]);

    expect(clash?.previous.slug).toBe("trop-longue");
  });

  it("finds the clash whatever order they arrive in", () => {
    // The seed places the day from three lists that never see one another, so
    // nothing guarantees they come sorted.
    const clash = findRoomClash([
      at(1, "la-seconde", "11:00", "11:40"),
      at(1, "la-premiere", "10:55", "11:35"),
    ]);

    expect(clash?.previous.slug).toBe("la-premiere");
  });
});

describe("two sessions in different rooms", () => {
  it("may run at the same time", () => {
    const clash = findRoomClash([
      at(1, "amphitheatre", "10:55", "11:35"),
      at(2, "agora", "10:55", "11:35"),
    ]);

    expect(clash).toBeNull();
  });
});

describe("a whole day", () => {
  it("reads cleanly when every room is used in turn", () => {
    const clash = findRoomClash([
      at(1, "matin", "08:50", "09:30"),
      at(1, "fin-de-matinee", "10:55", "11:35"),
      at(2, "quickie-a", "08:50", "09:10"),
      at(2, "quickie-b", "09:10", "09:30"),
      at(3, "seul", "08:50", "09:10"),
    ]);

    expect(clash).toBeNull();
  });
});
