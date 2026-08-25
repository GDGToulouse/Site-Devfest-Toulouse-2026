"use client";

import { use, useCallback, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";

import Tabs from "@/components/admin/Tabs";
import PublicTab from "@/components/sponsor-space/PublicTab";
import PrivateTab from "@/components/sponsor-space/PrivateTab";
import TeamTab from "@/components/sponsor-space/TeamTab";
import JobOffersTab from "@/components/sponsor-space/JobOffersTab";
import { getSponsorProfile, type SponsorSpaceProfile } from "@/lib/sponsor-api";
import { SPONSOR_ROLE_LABELS } from "@/lib/sponsor-roles";
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
  // Three outcomes, not two (#466). "Chargement…" used to cover all of them,
  // including the ones that would never resolve.
  const [outcome, setOutcome] = useState<"loading" | "denied" | "unreachable">("loading");
  const [activeTab, setActiveTab] = useState("public");

  const load = useCallback(async () => {
    setOutcome("loading");
    const { data, status } = await getSponsorProfile(id);
    if (status === 401) {
      router.replace(`/sponsor/login?next=/sponsor/${id}`);
      return;
    }
    if (data) {
      setProfile(data);
      return;
    }
    // A dropped connection comes back as status 0 (#428). Reporting that as
    // "not accessible with your account" sends the sponsor to ask for rights
    // they already have — missing and broken are not the same thing.
    setOutcome(status === 0 || status >= 500 ? "unreachable" : "denied");
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // `/sponsor/<slug>` is what the WordPress site exposed, and its 60 URLs are
  // still in Google's index (#466). `Number("capgemini")` is NaN, so the guard
  // that protected the API call left the page stuck on "Chargement…" forever,
  // served as a 200 with no title: a soft 404 for Google, a spinner with no end
  // for anyone following an old link. Placed after the hooks so their order
  // never changes; the render throws before any effect is committed.
  if (!Number.isInteger(id) || id <= 0) notFound();

  if (outcome === "denied") {
    return (
      <Shell>
        <p className="text-center text-noir">Cette fiche n&apos;est pas accessible avec votre compte.</p>
      </Shell>
    );
  }

  if (outcome === "unreachable") {
    return (
      <Shell>
        <p className="text-center text-noir">
          Votre espace n&apos;a pas pu être chargé. Vérifiez votre connexion et réessayez.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mx-auto mt-4 block rounded-[12px] bg-malachite px-5 py-2.5 font-bold text-blanc transition-colors hover:bg-malachite/90"
        >
          Réessayer
        </button>
      </Shell>
    );
  }

  if (!profile) {
    return <Shell><p className="text-center text-gris">Chargement…</p></Shell>;
  }

  const canEdit = profile.accessRole === "RESPONSABLE" || profile.accessRole === "EDITEUR";
  const canManageTeam = profile.accessRole === "RESPONSABLE";

  // Job offers are published on the public site, so STAND reads them like the
  // public tab; only EDITEUR and above may write (#251).
  const tabs = [
    { key: "public", label: "Fiche publique" },
    { key: "job-offers", label: "Offres d'emploi" },
    ...(canEdit ? [{ key: "private", label: "Informations privées" }] : []),
    ...(canManageTeam ? [{ key: "team", label: "Accès" }] : []),
  ];

  return (
    <Shell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-noir">{profile.name}</h1>
          <p className="text-sm text-gris">Espace partenaire · {SPONSOR_ROLE_LABELS[profile.accessRole]}</p>
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
        {activeTab === "job-offers" && <JobOffersTab sponsorId={id} canEdit={canEdit} />}
        {activeTab === "private" && canEdit && <PrivateTab sponsorId={id} />}
        {activeTab === "team" && canManageTeam && <TeamTab sponsorId={id} />}
      </div>
    </Shell>
  );
}

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
