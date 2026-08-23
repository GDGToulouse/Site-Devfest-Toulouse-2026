import { describe, it, expect } from "vitest";

import {
  emptySponsorForm,
  participationValue,
  type SponsorFormValue,
  type SponsorParticipation,
} from "./sponsor-form-shared";

// #429 — the sheet opened on the most recent participation and stayed there, so
// the tier, the logo and the com kit of an earlier year were editable nowhere.
// Those are precisely the fields #375 froze per year: switching year has to
// replace all of them at once, or the next save writes one year's value onto
// another and undoes the freeze.

function participation(over: Partial<SponsorParticipation> = {}): SponsorParticipation {
  return {
    editionId: 7,
    edition: { id: 7, year: 2025 },
    tier: { id: 3, key: "gold", nameFr: "Gold 2025", nameEn: "Gold 2025", rank: 20 },
    publicationStatus: "PUBLISHED",
    logoUrl: "/uploads/logo-2025.png",
    comKitReceived: true,
    comKitLogoWebUrl: "/uploads/web-2025.png",
    comKitLogoPrintUrl: "/uploads/print-2025.pdf",
    comKitCharterUrl: "/uploads/charte-2025.pdf",
    comKitNotes: "Reçu en septembre",
    platinumPromoIdea: "Atelier",
    platinumCoBuildIdea: "Table ronde",
    ...over,
  };
}

/** A form already filled with a *different* year, to switch away from. */
const filledWith2026: SponsorFormValue = {
  ...emptySponsorForm,
  name: "Occitania Data",
  descriptionFr: "Une description partagée par toutes les éditions",
  tierId: 1,
  logoUrl: "/uploads/logo-2026.png",
  publicationStatus: "DRAFT",
  comKitReceived: false,
  comKitLogoWebUrl: "/uploads/web-2026.png",
  comKitLogoPrintUrl: "/uploads/print-2026.pdf",
  comKitCharterUrl: "/uploads/charte-2026.pdf",
  comKitNotes: "Notes 2026",
  platinumPromoIdea: "Idée 2026",
  platinumCoBuildIdea: "Co-construction 2026",
};

describe("switching the year a sponsor sheet edits", () => {
  it("takes every year-scoped field from the year chosen", () => {
    const switched = { ...filledWith2026, ...participationValue(participation()) };

    expect(switched.tierId).toBe(3);
    expect(switched.logoUrl).toBe("/uploads/logo-2025.png");
    expect(switched.publicationStatus).toBe("PUBLISHED");
    expect(switched.comKitCharterUrl).toBe("/uploads/charte-2025.pdf");
  });

  it("leaves nothing of the year being left behind", () => {
    const switched = { ...filledWith2026, ...participationValue(participation()) };

    // The whole point: one field surviving the switch is one field the next
    // save writes onto 2025 with 2026's value.
    const leftovers = Object.entries(switched).filter(([, v]) => String(v).includes("2026"));
    expect(leftovers).toEqual([]);
  });

  it("does not touch the company's own fields", () => {
    const switched = { ...filledWith2026, ...participationValue(participation()) };

    // Name, description, socials and locale belong to the company, every year.
    expect(switched.name).toBe("Occitania Data");
    expect(switched.descriptionFr).toBe("Une description partagée par toutes les éditions");
  });

  it("falls back to the company logo when the year has none of its own", () => {
    const value = participationValue(participation({ logoUrl: null }), "/uploads/identity.png");

    expect(value.logoUrl).toBe("/uploads/identity.png");
  });

  it("shows an empty logo when neither the year nor the company has one", () => {
    const value = participationValue(participation({ logoUrl: null }), null);

    expect(value.logoUrl).toBe("");
  });

  it("reads a participation the list endpoint left thin", () => {
    // `GET /sponsors?editionId=` does not select the com kit or the logo, so
    // those come back undefined. The sheet must still produce a usable form
    // rather than undefined values that React turns into uncontrolled inputs.
    const thin = {
      editionId: 7,
      edition: { id: 7, year: 2024 },
      tier: { id: 2, key: "silver", nameFr: "Silver", nameEn: "Silver", rank: 10 },
      publicationStatus: "DRAFT",
    } as SponsorParticipation;

    const value = participationValue(thin);

    expect(value.comKitReceived).toBe(false);
    expect(value.comKitNotes).toBe("");
    expect(value.logoUrl).toBe("");
    expect(Object.values(value).every((v) => v !== undefined)).toBe(true);
  });
});
