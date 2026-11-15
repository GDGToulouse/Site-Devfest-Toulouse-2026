export interface CurrentEdition {
  id: number;
  year: number;
}

export interface EditionSummary {
  id: number;
  year: number;
  status: string;
}

// The "current edition" is the one being actively worked on: an edition in its
// last stretch (#576, #577) or announced, otherwise one in PREPARATION,
// otherwise the most recent. Shared by the sidebar and the event-day screens.
export function pickCurrentEdition(editions: EditionSummary[]): CurrentEdition | null {
  if (editions.length === 0) return null;
  const byPriority =
    editions.find((e) => ["EVENT_DAY", "PROGRAMME", "TICKETING", "ANNOUNCEMENT"].includes(e.status)) ??
    editions.find((e) => e.status === "PREPARATION") ??
    [...editions].sort((a, b) => b.year - a.year)[0];
  return { id: byPriority.id, year: byPriority.year };
}
