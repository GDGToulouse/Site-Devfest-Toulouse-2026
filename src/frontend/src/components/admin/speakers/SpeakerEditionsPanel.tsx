"use client";

import { useState } from "react";

import type { SpeakerEdition } from "@/lib/types";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import PublicationSwitch, { type ClosedOption, type ParticipationStatus } from "@/components/admin/PublicationSwitch";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ParticipationSponsorSelect from "@/components/admin/speakers/ParticipationSponsorSelect";

// #351 — a speaker is a person taking part in several editions. Each row here is
// one participation, carrying the state that used to sit on the speaker itself:
// publication status and the featured flag are per-year decisions — and so is
// the sponsor they worked for since #353.
interface SpeakerEditionsPanelProps {
  // Named in the unpublish confirmation, and the preview of a draft (#632).
  speakerName: string;
  speakerSlug: string;
  editions: SpeakerEdition[];
  allEditions: { id: number; year: number }[];
  onAttach: (editionId: number) => Promise<void>;
  onDetach: (editionId: number) => Promise<void>;
  // Resolves to whether the change was saved: each change here is written at
  // once, so the panel reports it itself (#632).
  onUpdate: (
    editionId: number,
    patch: { publicationStatus?: ParticipationStatus; isFeatured?: boolean; sponsorId?: number | null },
  ) => Promise<boolean>;
}

// A speaker who pulled out of a year (#726): off the site for that year like a
// draft, but not someone still to be announced. Their other years stay.
function withdrawnOption(speakerName: string, year: number): ClosedOption {
  return {
    status: "WITHDRAWN",
    label: "Retiré",
    hint: `Retiré : désisté pour ${year}, invisible sur le site pour cette édition. Les autres éditions ne changent pas.`,
    confirmTitle: `Marquer ${speakerName} comme retiré ?`,
    confirmMessage: `${speakerName} disparaîtra du site pour ${year} et sera classé à part, hors des brouillons. Ses autres éditions restent en ligne.`,
    confirmLabel: "Marquer retiré",
  };
}

const STATUS_FEEDBACK: Record<ParticipationStatus, string> = {
  PUBLISHED: "publié, visible sur le site.",
  DRAFT: "repassé en brouillon, retiré du site.",
  WITHDRAWN: "marqué retiré, invisible sur le site pour cette édition.",
};

export default function SpeakerEditionsPanel({
  speakerName,
  speakerSlug,
  editions,
  allEditions,
  onAttach,
  onDetach,
  onUpdate,
}: SpeakerEditionsPanelProps) {
  const [pendingEditionId, setPendingEditionId] = useState<string>("");
  const [busyId, setBusyId] = useState<number | null>(null);
  // Detaching a sponsor from an edition asks first; this did not, for the same
  // gesture on the other side of the model (#414).
  const [detachTarget, setDetachTarget] = useState<SpeakerEdition | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<SaveState>(null);

  const attachedIds = new Set(editions.map((e) => e.id));
  const available = allEditions.filter((e) => !attachedIds.has(e.id));

  async function run(editionId: number, action: () => Promise<unknown>) {
    setBusyId(editionId);
    await action();
    setBusyId(null);
  }

  // Unlike a form, nothing else says the click was saved: say it (#632).
  async function setStatus(participation: SpeakerEdition, status: ParticipationStatus) {
    setStatusFeedback(null);
    await run(participation.id, async () => {
      const isSaved = await onUpdate(participation.id, { publicationStatus: status });
      setStatusFeedback(
        !isSaved
          ? { kind: "error", text: `${participation.year} : le statut n'a pas pu être changé. Réessayez.` }
          : { kind: "ok", text: `${participation.year} : ${STATUS_FEEDBACK[status]}` },
      );
    });
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-noir mb-2">Éditions</h2>
      <SaveFeedback state={statusFeedback} onDismiss={() => setStatusFeedback(null)} />

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
                  <PublicationSwitch<ParticipationStatus>
                    label={`Statut de la participation ${participation.year}`}
                    closed={withdrawnOption(speakerName, participation.year)}
                    value={participation.publicationStatus}
                    // Saved on each click: what is shown is what is stored.
                    savedValue={participation.publicationStatus}
                    unpublishMessage={`Retirer ${speakerName} du site pour ${participation.year} ?`}
                    previewHref={`/api/preview?type=speaker&slug=${encodeURIComponent(speakerSlug)}`}
                    disabled={busyId === participation.id}
                    onChange={(status) => setStatus(participation, status)}
                  />
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
                    onClick={() => setDetachTarget(participation)}
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

      <ConfirmDialog
        isOpen={!!detachTarget}
        title="Retirer de cette édition"
        message={`Retirer ce speaker de l'édition ${detachTarget?.year} ? Sa fiche et ses autres participations sont conservées.`}
        confirmLabel="Retirer"
        variant="danger"
        onConfirm={() => {
          if (!detachTarget) return;
          const id = detachTarget.id;
          setDetachTarget(null);
          void run(id, () => onDetach(id));
        }}
        onCancel={() => setDetachTarget(null)}
      />
    </section>
  );
}
