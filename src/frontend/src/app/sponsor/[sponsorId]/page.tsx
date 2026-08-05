"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Tabs from "@/components/admin/Tabs";
import PublicTab from "@/components/sponsor-space/PublicTab";
import PrivateTab from "@/components/sponsor-space/PrivateTab";
import TeamTab from "@/components/sponsor-space/TeamTab";
import { getSponsorProfile, type SponsorSpaceProfile } from "@/lib/sponsor-api";
import { signOut } from "@/lib/admin-api";

// A sponsor's own space (#362), in three tabs — the split the issue asked for,
// replacing a single page where public and private fields were stacked.
//
// Which tabs exist depends on the role: the API refuses what the UI hides, so
// hiding is convenience, not protection.

export default function SponsorSpacePage({ params }: { params: Promise<{ sponsorId: string }> }) {
  const { sponsorId } = use(params);
  const id = Number(sponsorId);
  const router = useRouter();

  const [profile, setProfile] = useState<SponsorSpaceProfile | null>(null);
  const [isDenied, setIsDenied] = useState(false);
  const [activeTab, setActiveTab] = useState("public");

  const load = useCallback(async () => {
    const { data, status } = await getSponsorProfile(id);
    if (status === 401) {
      router.replace(`/sponsor/login?next=/sponsor/${id}`);
      return;
    }
    if (!data) {
      setIsDenied(true);
      return;
    }
    setProfile(data);
  }, [id, router]);

  useEffect(() => {
    if (Number.isInteger(id)) void load();
  }, [id, load]);

  if (isDenied) {
    return (
      <Shell>
        <p className="text-center text-noir">Cette fiche n&apos;est pas accessible avec votre compte.</p>
      </Shell>
    );
  }

  if (!profile) {
    return <Shell><p className="text-center text-gris">Chargement…</p></Shell>;
  }

  const canEdit = profile.accessRole === "RESPONSABLE" || profile.accessRole === "EDITEUR";
  const canManageTeam = profile.accessRole === "RESPONSABLE";

  const tabs = [
    { key: "public", label: "Fiche publique" },
    ...(canEdit ? [{ key: "private", label: "Informations privées" }] : []),
    ...(canManageTeam ? [{ key: "team", label: "Accès" }] : []),
  ];

  return (
    <Shell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-noir">{profile.name}</h1>
          <p className="text-sm text-gris">Espace partenaire · {ROLE_LABELS[profile.accessRole]}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/sponsor/login");
          }}
          className="text-sm font-medium text-gris hover:text-noir"
        >
          Déconnexion
        </button>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelId={(key) => `sponsor-panel-${key}`}
      />

      <div id={`sponsor-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "public" && <PublicTab profile={profile} canEdit={canEdit} onSaved={load} />}
        {activeTab === "private" && canEdit && <PrivateTab sponsorId={id} />}
        {activeTab === "team" && canManageTeam && <TeamTab sponsorId={id} />}
      </div>
    </Shell>
  );
}

const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE: "Responsable",
  EDITEUR: "Éditeur",
  STAND: "Stand",
};

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-blanc-casse">
      <header className="border-b border-gris/10 bg-blanc">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-devfest-96.png" alt="DevFest Toulouse" width={40} height={40} className="h-10 w-10" />
          <span className="font-bold text-noir">DevFest Toulouse</span>
        </div>
      </header>
      <main className={`mx-auto px-6 py-10 ${wide ? "max-w-4xl" : "max-w-md"}`}>{children}</main>
    </div>
  );
}
