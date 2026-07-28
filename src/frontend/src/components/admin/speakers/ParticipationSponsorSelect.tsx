"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor } from "@/lib/types";

// #353 — the sponsor of one participation. Sponsors are edition-scoped, so each
// row loads the list of its own year: a single shared list would offer 2019
// companies on a 2026 participation.
interface ParticipationSponsorSelectProps {
  editionId: number;
  year: number;
  value: number | null;
  disabled?: boolean;
  onChange: (sponsorId: number | null) => void;
}

export default function ParticipationSponsorSelect({
  editionId,
  year,
  value,
  disabled,
  onChange,
}: ParticipationSponsorSelectProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    adminFetch<Sponsor[]>(`/sponsors?editionId=${editionId}`).then(({ data }) => {
      if (data) setSponsors(data);
    });
  }, [editionId]);

  return (
    <select
      aria-label={`Sponsor associé pour l'édition ${year}`}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full max-w-[200px] rounded-lg border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50"
    >
      <option value="">— Aucun —</option>
      {sponsors.map((sponsor) => (
        <option key={sponsor.id} value={sponsor.id}>
          {sponsor.name}
        </option>
      ))}
    </select>
  );
}
