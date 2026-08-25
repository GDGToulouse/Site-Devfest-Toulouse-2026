// One room cannot hold two sessions at once (#462).
//
// Two sessions *following* each other in a room is the nominal 2026 shape —
// two 20-minute quickies fill the 40 minutes of the conferences beside them —
// so touching ranges are fine. Only a real overlap is a mistake.
//
// Pure on purpose: the seed places the day from three lists that never see one
// another, and this is what lets a test say what the rule is without a
// database to arrange first.

export interface RoomOccupation {
  slug: string;
  /** The room's frozen label (#375), or anything that names it in a message. */
  room: string;
  roomId: number;
  start: Date;
  end: Date;
}

export interface RoomClash {
  previous: RoomOccupation;
  current: RoomOccupation;
}

/** The first overlap found, or null when every room reads cleanly. */
export function findRoomClash(occupations: RoomOccupation[]): RoomClash | null {
  const byRoom = new Map<number, RoomOccupation[]>();
  for (const occupation of occupations) {
    const list = byRoom.get(occupation.roomId) ?? [];
    list.push(occupation);
    byRoom.set(occupation.roomId, list);
  }

  for (const list of byRoom.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      // Sorted by start, so an overlap is exactly "the one before has not
      // finished". Equal times are back to back, and allowed.
      if (previous.end > current.start) return { previous, current };
    }
  }
  return null;
}

export function describeRoomClash({ previous, current }: RoomClash): string {
  return (
    `${current.room}: "${previous.slug}" runs until ${previous.end.toISOString()} ` +
    `and "${current.slug}" starts at ${current.start.toISOString()}. ` +
    `Two sessions cannot overlap in one room.`
  );
}
