"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";

interface GeneralStats {
  totalArticles: number;
  unreadMessages: number;
  totalEditions: number;
}

interface FeaturedEdition {
  id: number;
  year: number;
  status: string;
  startDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
  partnerFormUrl: string | null;
  heroImageUrl: string | null;
}

interface EditionDetail {
  ticketTiersCount: number;
  articlesCount: number;
}

interface KeyFigure {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}

const STATUS_LABELS: Record<string, string> = {
  PREPARATION: "Préparation",
  ANNOUNCEMENT: "Annonce",
  SEE_YOU_NEXT_YEAR: "À l'année prochaine",
};

export default function AdminDashboard() {
  const [general, setGeneral] = useState<GeneralStats | null>(null);
  const [featured, setFeatured] = useState<FeaturedEdition | null>(null);
  const [editionDetail, setEditionDetail] = useState<EditionDetail | null>(null);
  const [keyFigures, setKeyFigures] = useState<KeyFigure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [articlesRes, messagesRes, editionsRes, editionRes] = await Promise.all([
        adminFetch<{ total: number }>("/articles?limit=1"),
        adminFetch<{ total: number }>("/contact/messages?limit=1"),
        adminFetch<{ id: number }[]>("/editions"),
        adminFetch<FeaturedEdition>("/editions/current"),
      ]);

      setGeneral({
        totalArticles: articlesRes.data?.total || 0,
        unreadMessages: messagesRes.data?.total || 0,
        totalEditions: Array.isArray(editionsRes.data) ? editionsRes.data.length : 0,
      });

      if (editionRes.data) {
        setFeatured(editionRes.data);

        // Load edition detail (counts) and key figures
        const [detailRes, figuresRes] = await Promise.all([
          adminFetch<EditionDetail>(`/editions/${editionRes.data.id}`),
          adminFetch<KeyFigure[]>(`/editions/${editionRes.data.id}/key-figures`),
        ]);

        if (detailRes.data) setEditionDetail(detailRes.data);
        if (figuresRes.data) setKeyFigures(figuresRes.data);
      }

      setIsLoading(false);
    }

    loadStats();
  }, []);

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold text-noir">Dashboard</h1>

      {/* Section 1: General */}
      <section>
        <h2 className="text-xl font-bold text-noir mb-4">Vue générale</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="Articles" value={String(general?.totalArticles || 0)} color="bleu" />
          <StatCard label="Messages non lus" value={String(general?.unreadMessages || 0)} color="terre-cuite" />
          <StatCard label="Éditions" value={String(general?.totalEditions || 0)} color="gris" />
        </div>
      </section>

      {/* Section 2: Featured Edition */}
      {featured && (
        <section>
          <h2 className="text-xl font-bold text-noir mb-4">
            Édition à la une — DevFest {featured.year}
          </h2>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Statut"
              value={STATUS_LABELS[featured.status] || featured.status}
              color="malachite"
            />
            <StatCard
              label="Date"
              value={featured.startDate ? formatDate(featured.startDate) : "Non définie"}
              color="noir"
            />
            <StatCard
              label="Lieu"
              value={featured.venueName ? `${featured.venueName}${featured.venueAddress ? `, ${featured.venueAddress}` : ""}` : "Non défini"}
              color="noir"
            />
            <StatCard
              label="Image hero"
              value={featured.heroImageUrl ? "Définie" : "Non définie"}
              color={featured.heroImageUrl ? "malachite" : "terre-cuite"}
            />
          </div>

          {/* Key figures + edition counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            {keyFigures.map((fig) => (
              <StatCard key={fig.labelFr} label={fig.labelFr} value={fig.value} color="bleu" />
            ))}
            {editionDetail && (
              <>
                <StatCard label="Articles" value={String(editionDetail.articlesCount)} color="bleu" />
                <StatCard label="Tarifs billetterie" value={String(editionDetail.ticketTiersCount)} color="bleu" />
              </>
            )}
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <InfoCard label="URL Partenaire" value={featured.partnerFormUrl} />
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-blanc rounded-xl shadow-card p-6">
      <p className="text-sm text-gris">{label}</p>
      <p className={`mt-2 text-2xl font-bold text-${color}`}>{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-blanc rounded-xl shadow-card p-6">
      <p className="text-sm text-gris">{label}</p>
      {value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm text-bleu hover:underline break-all block">
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm text-gris/50">Non défini</p>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
