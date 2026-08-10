"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";

interface SponsorRow {
  id: number;
  name: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  tier?: { id: number; nameFr: string };
}

interface EditionSponsorsTabProps {
  editionId: number;
}

// The sponsors signed for this edition, and attaching an existing company to it
// (#389). Distinct from the "Sponsoring" tab, which configures the *tiers
// offered* for the edition (#320) — the offer, not the signatures.
export default function EditionSponsorsTab({ editionId }: EditionSponsorsTabProps) {
  const [attached, setAttached] = useState<SponsorRow[]>([]);
  const [allSponsors, setAllSponsors] = useState<SponsorRow[]>([]);
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pickedSponsorId, setPickedSponsorId] = useState<number | null>(null);
  const [pickedTierId, setPickedTierId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ isOk: boolean; text: string } | null>(null);

  async function load() {
    const [ofEdition, everyone, catalogue] = await Promise.all([
      adminFetch<SponsorRow[]>(`/sponsors?editionId=${editionId}`),
      adminFetch<SponsorRow[]>("/sponsors"),
      adminFetch<AdminSponsorTier[]>("/sponsor-tiers"),
    ]);
    setAttached(ofEdition.data ?? []);
    setAllSponsors(everyone.data ?? []);
    setTiers(catalogue.data ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  useEffect(() => {
    if (pickedTierId === null && tiers[0]) setPickedTierId(tiers[0].id);
  }, [tiers, pickedTierId]);

  // Only companies not already attached to this edition, narrowed by the search
  // box — the full list runs to dozens of rows.
  const candidates = useMemo(() => {
    const taken = new Set(attached.map((s) => s.id));
    const needle = search.trim().toLowerCase();
    return allSponsors
      .filter((s) => !taken.has(s.id))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle));
  }, [allSponsors, attached, search]);

  useEffect(() => {
    if (pickedSponsorId === null || !candidates.some((s) => s.id === pickedSponsorId)) {
      setPickedSponsorId(candidates[0]?.id ?? null);
    }
  }, [candidates, pickedSponsorId]);

  async function attach() {
    if (!pickedSponsorId || !pickedTierId) return;
    setIsBusy(true);
    setMessage(null);
    const { status } = await adminFetch(`/sponsors/${pickedSponsorId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId, tierId: pickedTierId }),
    });
    setIsBusy(false);
    if (status === 200 || status === 201) {
      const name = allSponsors.find((s) => s.id === pickedSponsorId)?.name;
      setMessage({ isOk: true, text: `${name} rattaché à cette édition, en brouillon.` });
      setSearch("");
      void load();
    } else {
      setMessage({ isOk: false, text: "Échec du rattachement." });
    }
  }

  async function detach(sponsor: SponsorRow) {
    if (!window.confirm(`Retirer ${sponsor.name} de cette édition ? La fiche de l'entreprise est conservée.`)) return;
    setIsBusy(true);
    setMessage(null);
    const { status } = await adminFetch(`/sponsors/${sponsor.id}/editions/${editionId}`, { method: "DELETE" });
    setIsBusy(false);
    if (status === 204) {
      setMessage({ isOk: true, text: `${sponsor.name} retiré de cette édition.` });
      void load();
    } else {
      setMessage({ isOk: false, text: "Échec du retrait." });
    }
  }

  if (isLoading) return <p className="text-sm text-gris">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-bold text-noir">Sponsors de cette édition</h2>
        <p className="text-sm text-gris">
          Les entreprises qui sponsorisent cette année. Pour configurer les niveaux proposés sur
          la page « Devenir sponsor », voir l&apos;onglet Sponsoring.
        </p>
      </div>

      {attached.length === 0 ? (
        <p className="text-sm text-gris">Aucun sponsor rattaché à cette édition.</p>
      ) : (
        <ul className="space-y-2">
          {attached.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gris/15 bg-blanc px-3 py-2"
            >
              <Link href={`/admin/sponsors/${s.id}`} className="min-w-[180px] flex-1 text-sm font-medium text-noir hover:underline">
                {s.name}
              </Link>
              <span className="text-sm text-gris">{s.tier?.nameFr ?? "—"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.publicationStatus === "PUBLISHED"
                    ? "bg-malachite/10 text-malachite"
                    : "bg-gris/10 text-gris"
                }`}
              >
                {s.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
              </span>
              <button
                type="button"
                onClick={() => detach(s)}
                disabled={isBusy}
                className="text-xs font-medium text-terre-cuite hover:underline disabled:opacity-50"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4">
        <p className="mb-3 text-sm font-medium text-noir">Rattacher une entreprise existante</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs text-gris">Rechercher</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom de l'entreprise"
              className={inputClass}
            />
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs text-gris">Entreprise</span>
            <select
              value={pickedSponsorId ?? ""}
              onChange={(e) => setPickedSponsorId(Number(e.target.value))}
              disabled={candidates.length === 0}
              className={inputClass}
            >
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px]">
            <span className="mb-1 block text-xs text-gris">Niveau</span>
            <select
              value={pickedTierId ?? ""}
              onChange={(e) => setPickedTierId(Number(e.target.value))}
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
            disabled={isBusy || !pickedSponsorId || !pickedTierId}
            className="rounded-lg bg-malachite px-3 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            Rattacher
          </button>
        </div>
        {candidates.length === 0 && (
          <p className="mt-2 text-sm text-gris">
            {search.trim()
              ? "Aucune entreprise ne correspond à cette recherche."
              : "Toutes les entreprises sont déjà rattachées à cette édition."}
          </p>
        )}
        <p className="mt-3 text-xs text-gris">
          L&apos;entreprise n&apos;existe pas encore ?{" "}
          <Link href={`/admin/sponsors/new?editionId=${editionId}`} className="font-medium text-malachite hover:underline">
            Créer un sponsor pour cette édition
          </Link>
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.isOk ? "text-malachite" : "text-terre-cuite"}`}>{message.text}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
