"use client";

import { useState } from "react";

import type { SpeakerEdition } from "@/lib/types";
import StatusBadge from "@/components/admin/StatusBadge";
import ParticipationSponsorSelect from "@/components/admin/speakers/ParticipationSponsorSelect";

// #351 — a speaker is a person taking part in several editions. Each row here is
// one participation, carrying the state that used to sit on the speaker itself:
// publication status and the featured flag are per-year decisions — and so is
// the sponsor they worked for since #353.
interface SpeakerEditionsPanelProps {
  editions: SpeakerEdition[];
  allEditions: { id: number; year: number }[];
  onAttach: (editionId: number) => Promise<void>;
  onDetach: (editionId: number) => Promise<void>;
  onUpdate: (
    editionId: number,
    patch: { publicationStatus?: "DRAFT" | "PUBLISHED"; isFeatured?: boolean; sponsorId?: number | null },
  ) => Promise<void>;
}

export default function SpeakerEditionsPanel({
  editions,
  allEditions,
  onAttach,
  onDetach,
  onUpdate,
}: SpeakerEditionsPanelProps) {
  const [pendingEditionId, setPendingEditionId] = useState<string>("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const attachedIds = new Set(editions.map((e) => e.id));
  const available = allEditions.filter((e) => !attachedIds.has(e.id));

  async function run(editionId: number, action: () => Promise<void>) {
    setBusyId(editionId);
    await action();
    setBusyId(null);
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-noir mb-2">Éditions</h2>

      {editions.length === 0 ? (
        <p className="text-sm text-gris mb-3">
          Ce speaker n&apos;est rattaché à aucune édition — il n&apos;apparaît donc nulle part sur le
          site.
        </p>
      ) : (
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left text-gris">
              <th className="py-1 font-medium">Année</th>
              <th className="py-1 font-medium">Statut</th>
              <th className="py-1 font-medium">À la une</th>
              <th className="py-1 font-medium">Sponsor</th>
              <th className="py-1 font-medium sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((participation) => (
              <tr key={participation.id} className="border-t border-gris/15">
                <td className="py-2 font-medium text-noir">{participation.year}</td>
                <td className="py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participation.publicationStatus === "PUBLISHED"}
                      disabled={busyId === participation.id}
                      onChange={(e) =>
                        run(participation.id, () =>
                          onUpdate(participation.id, {
                            publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT",
                          }),
                        )
                      }
                      className="rounded border-gris/30 text-malachite focus:ring-malachite"
                    />
                    <StatusBadge
                      status={participation.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
                      variant={participation.publicationStatus === "PUBLISHED" ? "green" : "gray"}
                    />
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    aria-label={`En vedette sur l'édition ${participation.year}`}
                    checked={participation.isFeatured}
                    disabled={busyId === participation.id}
                    onChange={(e) =>
                      run(participation.id, () =>
                        onUpdate(participation.id, { isFeatured: e.target.checked }),
                      )
                    }
                    className="rounded border-gris/30 text-malachite focus:ring-malachite"
                  />
                </td>
                <td className="py-2">
                  <ParticipationSponsorSelect
                    editionId={participation.id}
                    year={participation.year}
                    value={participation.sponsorId}
                    disabled={busyId === participation.id}
                    onChange={(sponsorId) =>
                      run(participation.id, () => onUpdate(participation.id, { sponsorId }))
                    }
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={busyId === participation.id}
                    onClick={() => run(participation.id, () => onDetach(participation.id))}
                    className="text-sm text-terre-cuite hover:underline disabled:opacity-50"
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            aria-label="Ajouter une édition"
            value={pendingEditionId}
            onChange={(e) => setPendingEditionId(e.target.value)}
            className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            <option value="">Ajouter une édition…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.year}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pendingEditionId}
            onClick={async () => {
              const id = Number(pendingEditionId);
              setPendingEditionId("");
              await run(id, () => onAttach(id));
            }}
            className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}
    </section>
  );
}
