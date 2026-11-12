import { describe, expect, it } from "vitest";

import type { SearchHit } from "@/lib/arrivals-api";
import { whereTo } from "./CounterSearch";

const hit = (over: Partial<SearchHit>): SearchHit => ({
  id: 1,
  firstName: "Léa",
  lastName: "Martin",
  company: null,
  tierName: "Normal",
  badgeNumber: 2147,
  badgeState: "TO_FETCH",
  isCancelled: false,
  isDedicated: false,
  scannedAt: null,
  scannedBy: null,
  labelCount: 0,
  labelDeliveredAt: null,
  ...over,
});

describe("where a counter sends the person it found (#802)", () => {
  it("should say the card is here, at this counter", () => {
    expect(whereTo(hit({}), "READY", 2)).toBe("Ici, badge 2 1 47 : prêt");
  });

  it("should send the person to their own counter", () => {
    expect(whereTo(hit({}), "TO_FETCH", 1)).toBe("Au guichet 2, badge 2 1 47 : à chercher");
  });

  it("should say where an unscanned badge waits", () => {
    expect(whereTo(hit({}), "PRINTED", 2)).toBe("Ici, badge 2 1 47 sur le présentoir 1 : pas encore scanné");
  });

  it("should send a ticket without a badge, or cancelled, to the help desk", () => {
    expect(whereTo(hit({ badgeNumber: null }), "PRINTED", 2)).toBe("Sans badge : Cas particuliers");
    expect(whereTo(hit({ isCancelled: true }), "TO_FETCH", 2)).toBe("Billet annulé : Cas particuliers");
  });

  it("should send a dedicated ticket to its own desk", () => {
    expect(whereTo(hit({ isDedicated: true, badgeNumber: null }), "PRINTED", 2)).toBe("Accueil dédié");
  });
});
