// How the printed programme is grouped (#449).
//
// In the URL rather than in local state, for two reasons: it makes the
// per-room sheet a link someone can send ("imprime celle-ci pour l'Amphi"),
// and it makes the second rendering reachable by anything that prints a page
// without clicking first — which is how it gets verified at all.

export type PrintGrouping = "time" | "room";

export function parsePrintGrouping(param: string | undefined | null): PrintGrouping {
  return param === "room" ? "room" : "time";
}
