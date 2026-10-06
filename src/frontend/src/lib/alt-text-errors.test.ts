import { describe, it, expect } from "vitest";

import { altGenerationErrorMessage } from "./alt-text-errors";

describe("altGenerationErrorMessage (#504)", () => {
  it("should give the retry delay of an exhausted quota, read from the error body", () => {
    expect(altGenerationErrorMessage(429, { error: "quota_exhausted", retryAfterSec: 42 })).toBe(
      "Quota Gemini atteint. Réessayez dans 42 s.",
    );
  });

  it("should name the refused format instead of a bare failure", () => {
    expect(altGenerationErrorMessage(415)).toBe("Ce format d'image n'est pas pris en charge (ICO non supporté).");
  });

  it("should tell an unreachable server apart from a failed generation", () => {
    expect(altGenerationErrorMessage(0)).toMatch(/ne répond pas/);
    expect(altGenerationErrorMessage(502)).toBe("Échec de la génération automatique du texte alternatif.");
  });
});
