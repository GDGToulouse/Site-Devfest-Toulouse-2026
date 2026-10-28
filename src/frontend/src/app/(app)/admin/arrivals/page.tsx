"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import ArrivalsManager from "@/components/admin/arrivals/ArrivalsManager";
import { pickCurrentEdition, type CurrentEdition, type EditionSummary } from "@/components/admin/current-edition";

// Event-day hub (#638, #639): attendees and badges of the current edition. Not
// an edition tab: the team runs it on the day, not while editing the edition.
export default function AdminArrivalsPage() {
  const [edition, setEdition] = useState<CurrentEdition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminFetch<EditionSummary[]>("/editions").then(({ data }) => {
      setEdition(data ? pickCurrentEdition(data) : null);
      setIsLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-2">Arrivées</h1>
      <p className="text-gris mb-6">
        {edition
          ? `DevFest ${edition.year} : participants importés de Billetweb, numérotation et impression des badges.`
          : "Participants importés de Billetweb, numérotation et impression des badges."}
      </p>

      <div className="bg-blanc rounded-xl shadow-card p-6">
        {isLoading ? (
          <p className="text-gris text-sm">Chargement…</p>
        ) : edition ? (
          <ArrivalsManager editionId={edition.id} />
        ) : (
          <p className="text-gris text-sm">Aucune édition : créez-en une, menu Éditions.</p>
        )}
      </div>
    </div>
  );
}
