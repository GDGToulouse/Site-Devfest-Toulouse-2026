"use client";

import { useEffect, useMemo, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";

interface Participation {
  editionId: number;
  edition: { id: number; year: number };
  tier: { id: number; nameFr: string };
  publicationStatus: "DRAFT" | "PUBLISHED";
}

interface SponsorEditionsProps {
  sponsorId: number;
  tiers: AdminSponsorTier[];
}

// A company's participations (#389). Since #129 a sponsor spans editions, so
// attaching it to another year is adding a participation — not duplicating the
// company, which the global slug forbids anyway.
export default function SponsorEditions({ sponsorId, tiers }: SponsorEditionsProps) {
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEditionId, setNewEditionId] = useState<number | null>(null);
  const [newTierId, setNewTierId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ isOk: boolean; text: string } | null>(null);

  async function load() {
    const [sponsor, allEditions] = await Promise.all([
      adminFetch<{ editions?: Participation[] }>(`/sponsors/${sponsorId}`),
      adminFetch<{ id: number; year: number }[]>("/editions"),
    ]);
    setParticipations(sponsor.data?.editions ?? []);
    setEditions(allEditions.data ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  // A year already attached cannot be added twice — @@unique([sponsorId,
  // editionId]) — so it leaves the picker instead of failing on submit.
  const availableEditions = useMemo(() => {
    const taken = new Set(participations.map((p) => p.editionId));
    return editions.filter((e) => !taken.has(e.id));
  }, [editions, participations]);

  useEffect(() => {
    if (newEditionId === null || !availableEditions.some((e) => e.id === newEditionId)) {
      setNewEditionId(availableEditions[0]?.id ?? null);
    }
  }, [availableEditions, newEditionId]);

  useEffect(() => {
    if (newTierId === null && tiers[0]) setNewTierId(tiers[0].id);
  }, [tiers, newTierId]);

  async function attach() {
    if (!newEditionId || !newTierId) return;
    setIsBusy(true);
    setMessage(null);
    const { status } = await adminFetch(`/sponsors/${sponsorId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId: newEditionId, tierId: newTierId }),
    });
    setIsBusy(false);
    if (status === 200 || status === 201) {
      const year = editions.find((e) => e.id === newEditionId)?.year;
      setMessage({ isOk: true, text: `Édition ${year} rattachée, en brouillon.` });
      void load();
    } else {
      setMessage({ isOk: false, text: "Échec du rattachement." });
    }
  }

  async function detach(participation: Participation) {
    const year = participation.edition.year;
    if (!window.confirm(`Retirer la participation ${year} ? La fiche de l'entreprise est conservée.`)) return;
    setIsBusy(true);
    setMessage(null);
    const { status } = await adminFetch(`/sponsors/${sponsorId}/editions/${participation.editionId}`, {
      method: "DELETE",
    });
    setIsBusy(false);
    if (status === 204) {
      setMessage({ isOk: true, text: `Participation ${year} retirée.` });
      void load();
    } else {
      setMessage({ isOk: false, text: "Échec du retrait." });
    }
  }

  return (
    <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4 space-y-4">
      <p className="text-sm font-medium text-noir">Éditions</p>

      {isLoading ? (
        <p className="text-sm text-gris">Chargement…</p>
      ) : participations.length === 0 ? (
        <p className="text-sm text-gris">Aucune participation pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {participations.map((p) => (
            <li
              key={p.editionId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gris/15 bg-blanc px-3 py-2"
            >
              <span className="min-w-[60px] text-sm font-medium text-noir">{p.edition.year}</span>
              <span className="flex-1 text-sm text-gris">{p.tier.nameFr}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.publicationStatus === "PUBLISHED"
                    ? "bg-malachite/10 text-malachite"
                    : "bg-gris/10 text-gris"
                }`}
              >
                {p.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
              </span>
              <button
                type="button"
                onClick={() => detach(p)}
                disabled={isBusy}
                className="text-xs font-medium text-terre-cuite hover:underline disabled:opacity-50"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gris/15 pt-3">
        <p className="mb-2 text-xs font-semibold text-gris">Rattacher à une édition</p>
        {availableEditions.length === 0 ? (
          <p className="text-sm text-gris">Cette entreprise participe déjà à toutes les éditions.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px]">
              <span className="mb-1 block text-xs text-gris">Édition</span>
              <select
                value={newEditionId ?? ""}
                onChange={(e) => setNewEditionId(Number(e.target.value))}
                className={inputClass}
              >
                {availableEditions.map((e) => (
                  <option key={e.id} value={e.id}>{e.year}</option>
                ))}
              </select>
            </label>
            <label className="min-w-[160px]">
              <span className="mb-1 block text-xs text-gris">Niveau</span>
              <select
                value={newTierId ?? ""}
                onChange={(e) => setNewTierId(Number(e.target.value))}
                className={inputClass}
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.nameFr}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={attach}
              disabled={isBusy || !newEditionId || !newTierId}
              className="rounded-lg bg-malachite px-3 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              Rattacher
            </button>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.isOk ? "text-malachite" : "text-terre-cuite"}`}>{message.text}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
