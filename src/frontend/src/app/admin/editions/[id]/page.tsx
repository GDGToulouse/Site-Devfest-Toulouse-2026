"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import Tabs from "@/components/admin/Tabs";
import GeneralTab from "@/components/admin/edition-detail/GeneralTab";
import TicketingTab from "@/components/admin/edition-detail/TicketingTab";
import CfpTab from "@/components/admin/edition-detail/CfpTab";
import KeyFiguresTab from "@/components/admin/edition-detail/KeyFiguresTab";
import SponsoringTab from "@/components/admin/edition-detail/SponsoringTab";
import SponsorsTab from "@/components/admin/edition-detail/SponsorsTab";

interface EditionData {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  venueName: string | null;
  venueAddress: string | null;
  heroImageUrl: string | null;
  sponsorFormUrl: string | null;
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
  ticketTiersCount: number;
  articlesCount: number;
}

const STATUS_LABELS: Record<string, { label: string; variant: "green" | "orange" | "gray" }> = {
  PREPARATION: { label: "Préparation", variant: "gray" },
  ANNOUNCEMENT: { label: "Annonce", variant: "green" },
  SEE_YOU_NEXT_YEAR: { label: "À l'année prochaine", variant: "orange" },
};

const TABS = [
  { key: "general", label: "Général" },
  { key: "ticketing", label: "Billetterie" },
  { key: "speakers", label: "Speakers (0)" },
  { key: "conferences", label: "Conférences (0)" },
  { key: "sponsors", label: "Sponsors" },
  { key: "sponsoring", label: "Sponsoring" },
  { key: "cfp", label: "CFP" },
  { key: "key-figures", label: "Chiffres clés" },
];

export default function EditionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const editionId = Number(params.id);

  const [edition, setEdition] = useState<EditionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");

  async function loadEdition() {
    const { data, status } = await adminFetch<EditionData>(`/editions/${editionId}`);
    if (status === 404 || !data) {
      router.push(`/admin/editions`);
      return;
    }
    setEdition(data);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!isNaN(editionId)) loadEdition();
  }, [editionId]);

  if (isLoading || !edition) return <p className="text-gris">Chargement...</p>;

  const statusInfo = STATUS_LABELS[edition.status] || { label: edition.status, variant: "gray" as const };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push(`/admin/editions`)}
          className="text-gris hover:text-noir transition-colors"
          title="Retour"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">DevFest {edition.year}</h1>
        <StatusBadge status={statusInfo.label} variant={statusInfo.variant} />
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "general" && (
          <GeneralTab edition={edition} onSaved={loadEdition} />
        )}
        {activeTab === "ticketing" && (
          <TicketingTab editionId={edition.id} />
        )}
        {activeTab === "speakers" && (
          <div className="py-12 text-center text-gris">
            <p className="text-lg font-medium">Speakers</p>
            <p className="mt-2 text-sm">Fonctionnalité à venir — gestion des speakers de l&apos;édition.</p>
          </div>
        )}
        {activeTab === "conferences" && (
          <div className="py-12 text-center text-gris">
            <p className="text-lg font-medium">Conférences</p>
            <p className="mt-2 text-sm">Fonctionnalité à venir — gestion des conférences de l&apos;édition.</p>
          </div>
        )}
        {activeTab === "sponsors" && (
          <SponsorsTab editionId={edition.id} />
        )}
        {activeTab === "sponsoring" && (
          <SponsoringTab editionId={edition.id} />
        )}
        {activeTab === "cfp" && (
          <CfpTab />
        )}
        {activeTab === "key-figures" && (
          <KeyFiguresTab editionId={edition.id} />
        )}
      </div>
    </div>
  );
}
