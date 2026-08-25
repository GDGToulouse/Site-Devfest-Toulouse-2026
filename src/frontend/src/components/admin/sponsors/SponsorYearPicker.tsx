"use client";

import { useId } from "react";

import type { SponsorParticipation } from "./sponsor-form-shared";

// Which participation the year-scoped panels are editing (#429).
//
// The sheet used to open on the most recent year and stay there: a company
// attached to 2026 and 2025 had no way to reach its 2025 tier, logo or com kit
// — the very fields #375 froze per year, so there was nowhere to correct them.
//
// Only shown when there is a choice to make. On a company with a single
// participation the year is already in the tab label and the heading, and a
// select with one option is furniture.
export default function SponsorYearPicker({
  participations,
  editionId,
  onChange,
}: {
  participations: SponsorParticipation[];
  editionId: number | null;
  onChange: (participation: SponsorParticipation) => void;
}) {
  const id = useId();
  if (participations.length < 2) return null;

  return (
    <label htmlFor={id} className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-noir">Année éditée</span>
      <select
        id={id}
        value={editionId ?? ""}
        onChange={(e) => {
          const next = participations.find((p) => p.editionId === Number(e.target.value));
          if (next) onChange(next);
        }}
        className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
      >
        {participations.map((p) => (
          <option key={p.editionId} value={p.editionId}>
            {p.edition.year}
          </option>
        ))}
      </select>
      <span className="text-sm text-gris">
        Les champs ci-dessous ne concernent que cette année.
      </span>
    </label>
  );
}
