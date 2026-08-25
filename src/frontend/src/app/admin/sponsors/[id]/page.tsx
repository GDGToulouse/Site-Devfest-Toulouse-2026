"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, AdminSponsorTier } from "@/lib/types";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import Tabs from "@/components/admin/Tabs";
import SponsorContacts from "@/components/admin/sponsors/SponsorContacts";
import SponsorEditions from "@/components/admin/sponsors/SponsorEditions";
import SponsorIdentityFields from "@/components/admin/sponsors/SponsorIdentityFields";
import SponsorParticipationFields from "@/components/admin/sponsors/SponsorParticipationFields";
import SponsorComKitFields from "@/components/admin/sponsors/SponsorComKitFields";
import SponsorYearPicker from "@/components/admin/sponsors/SponsorYearPicker";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  emptySponsorForm,
  participationValue,
  type SponsorFormValue,
  type SponsorParticipation,
} from "@/components/admin/sponsors/sponsor-form-shared";

interface SponsorData extends Sponsor {
  edition?: { id: number; year: number };
  // Every year the company took part in, each carrying its own tier, logo and
  // com kit (#429).
  editions?: SponsorParticipation[];
}

// The sheet is split along the line the data model already draws (#393): the
// company on one side, the participation to one edition on the other. Stacking
// both on a single 2300px screen hid that distinction — an organizer who
// attached 2025 and then scrolled up to change "the logo" was overwriting the
// 2026 one. The year now lives in a tab label, permanently visible.
const IDENTITY_TAB = "identite";
const PARTICIPATION_TAB = "participation";
const COM_KIT_TAB = "kit-de-com";
const CONTACTS_TAB = "contacts";

export default function SponsorEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const sponsorId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<SponsorFormValue>(emptySponsorForm);
  const [current, setCurrent] = useState<SponsorData | null>(null);
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [editionYear, setEditionYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Feedback after a save (#394), shown in place instead of redirecting away.
  const [saveState, setSaveState] = useState<SaveState>(null);
  // Set when the chosen name belongs to a company already in base (#389).
  const [existingSponsorId, setExistingSponsorId] = useState<number | null>(null);
  // A year switch waiting on confirmation, because the form holds unsaved
  // changes for the year being left (#429).
  const [pendingYear, setPendingYear] = useState<SponsorParticipation | null>(null);

  const participations = current?.editions ?? [];
  const editedParticipation = participations.find((p) => p.editionId === editionId) ?? null;

  // Switching year replaces every year-scoped field at once. Anything typed
  // and not saved for the year being left would go with it, silently — so ask
  // first, and only when there is really something to lose.
  function isParticipationDirty(): boolean {
    if (!editedParticipation) return false;
    const saved = participationValue(editedParticipation, current?.logoUrl);
    return (Object.keys(saved) as (keyof typeof saved)[]).some((k) => form[k] !== saved[k]);
  }

  function applyYear(p: SponsorParticipation) {
    setForm((f) => ({ ...f, ...participationValue(p, current?.logoUrl) }));
    setEditionId(p.editionId);
    setEditionYear(p.edition.year);
    setSaveState(null);
  }

  function requestYear(p: SponsorParticipation) {
    if (isParticipationDirty()) {
      setPendingYear(p);
      return;
    }
    applyYear(p);
  }

  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl ?? IDENTITY_TAB);

  // The tier catalogue drives the "Niveau" <select> and the promo-idea gating.
  useEffect(() => {
    adminFetch<AdminSponsorTier[]>("/sponsor-tiers").then(({ data }) => {
      if (!data) return;
      setTiers(data);
      // A brand-new sponsor needs a tier picked up front (tierId is required).
      // Default to the *lowest* rank rather than the most prominent one: the
      // list is sorted by rank desc, so data[0] silently pre-selected Platinum
      // — the most expensive tier, chosen by accident (#393).
      if (isNew) {
        const lowest = data[data.length - 1];
        if (lowest) setForm((f) => (f.tierId === null ? { ...f, tierId: lowest.id } : f));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isNew) {
      adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
        if (data) {
          setEditions(data);
          const preset = Number(searchParams.get("editionId"));
          const chosen = data.find((e) => e.id === preset) ?? data[0];
          if (chosen) {
            setEditionId(chosen.id);
            setEditionYear(chosen.year);
          }
        }
      });
    } else if (sponsorId) {
      void loadSponsor(Number(searchParams.get("editionId")) || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId, isNew]);

  // Read the sheet back from the server. Called on mount and again after each
  // save, so the baseline the year picker compares against is always what the
  // server holds (#429) — measured against a stale one, a real unsaved change
  // reads as clean and switching year discards it in silence.
  async function loadSponsor(preferEditionId?: number) {
    if (!sponsorId) return;
    await adminFetch<SponsorData>(`/sponsors/${sponsorId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/admin/sponsors");
          return;
        }
        setCurrent(data);

        // Which year the sheet opens on. The link from an edition's Sponsors
        // tab carries `?editionId=` so it lands on the participation the
        // organiser was looking at; without it, the most recent one, which is
        // what the API flattens on top of the payload (#429).
        const chosen =
          data.editions?.find((e) => e.editionId === preferEditionId) ??
          data.editions?.[0] ??
          null;
        const chosenValue = chosen
          ? participationValue(chosen, data.logoUrl)
          : {
              tierId: data.tierId,
              logoUrl: data.logoUrl || "",
              publicationStatus: data.publicationStatus,
              comKitReceived: data.comKitReceived ?? false,
              comKitLogoWebUrl: data.comKitLogoWebUrl || "",
              comKitLogoPrintUrl: data.comKitLogoPrintUrl || "",
              comKitCharterUrl: data.comKitCharterUrl || "",
              comKitNotes: data.comKitNotes || "",
              platinumPromoIdea: data.platinumPromoIdea || "",
              platinumCoBuildIdea: data.platinumCoBuildIdea || "",
            };

        setForm({
          name: data.name,
          websiteUrl: data.websiteUrl || "",
          descriptionFr: data.descriptionFr || "",
          descriptionEn: data.descriptionEn || "",
          linkedin: data.socialLinks?.linkedin || "",
          twitter: data.socialLinks?.twitter || "",
          bluesky: data.socialLinks?.bluesky || "",
          locale: data.locale === "en" ? "en" : "fr",
          ...chosenValue,
        });
        setEditionId(chosen?.editionId ?? data.editionId);
        setEditionYear(chosen?.edition.year ?? data.edition?.year ?? null);
        setIsLoading(false);
    });
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (!isNew) router.replace(`/admin/sponsors/${params.id}?tab=${tab}`, { scroll: false });
  }

  async function handleSave() {
    if (!form.name.trim() || !editionId || !form.tierId) return;
    setIsSaving(true);
    setError(null);
    const socialLinks: Record<string, string> = {};
    if (form.linkedin.trim()) socialLinks.linkedin = form.linkedin.trim();
    if (form.twitter.trim()) socialLinks.twitter = form.twitter.trim();
    if (form.bluesky.trim()) socialLinks.bluesky = form.bluesky.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      tierId: form.tierId,
      logoUrl: form.logoUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      descriptionFr: form.descriptionFr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      socialLinks,
      locale: form.locale,
      publicationStatus: form.publicationStatus,
      comKitReceived: form.comKitReceived,
      comKitLogoWebUrl: form.comKitLogoWebUrl || undefined,
      comKitLogoPrintUrl: form.comKitLogoPrintUrl || undefined,
      comKitCharterUrl: form.comKitCharterUrl || undefined,
      comKitNotes: form.comKitNotes || undefined,
      platinumPromoIdea: form.platinumPromoIdea || undefined,
      platinumCoBuildIdea: form.platinumCoBuildIdea || undefined,
    };

    if (isNew) {
      const { data, status, errorBody } = await adminFetch<{ id: number }>("/sponsors", { method: "POST", body: JSON.stringify(payload) });
      setIsSaving(false);
      // The slug is global since #129, so a taken name means the company is
      // already there — offer to attach it to the chosen edition rather than
      // leaving the editor at a dead end (#389).
      if (status === 409 && typeof errorBody?.id === "number") {
        setExistingSponsorId(errorBody.id);
        setError(null);
        return;
      }
      if (status >= 400 || !data) {
        setError("Échec de la création.");
        return;
      }
      router.push(`/admin/sponsors/${data.id}`);
    } else {
      const { status } = await adminFetch(`/sponsors/${sponsorId}`, { method: "PUT", body: JSON.stringify(payload) });
      setIsSaving(false);
      // Anything but 200 failed, network included: a dropped connection comes
      // back as status 0, which `>= 400` announced as a save (#428).
      if (status !== 200) {
        setSaveState({ kind: "error", text: "Échec de l'enregistrement. Réessayez." });
        return;
      }
      // Stays on the page rather than redirecting to the list (#394): the
      // redirect was the only signal, and it looked exactly like Cancel.
      setSaveState({ kind: "ok", text: "Modifications enregistrées." });
      // Stay on the year that was just saved.
      await loadSponsor(editionId);
    }
  }

  // Attach the existing company to the edition picked above, then open its
  // sheet where the other participations are managed.
  async function attachExisting() {
    if (!existingSponsorId || !editionId || !form.tierId) return;
    setIsSaving(true);
    const { status } = await adminFetch(`/sponsors/${existingSponsorId}/editions`, {
      method: "POST",
      body: JSON.stringify({ editionId, tierId: form.tierId }),
    });
    setIsSaving(false);
    if (status === 200 || status === 201) {
      router.push(`/admin/sponsors/${existingSponsorId}`);
    } else {
      setError("Échec du rattachement.");
    }
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  // The year is part of the label rather than a line of grey text above the
  // form: it scopes everything in the panel, so it has to stay on screen.
  const tabs = [
    { key: IDENTITY_TAB, label: "Identité" },
    { key: PARTICIPATION_TAB, label: editionYear ? `Participation ${editionYear}` : "Participation" },
    { key: COM_KIT_TAB, label: "Kit de com" },
    { key: CONTACTS_TAB, label: "Contacts & accès" },
  ];

  const isSaveBlocked = !form.name.trim() || !editionId || !form.tierId;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/sponsors")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">
          {isNew ? "Nouveau sponsor" : current?.name || "Modifier le sponsor"}
        </h1>
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6">
        {isNew ? (
          // On create there is nothing to tab through yet: one edition, one
          // tier, one name. The panels appear once the company exists.
          <div className="space-y-4">
            <label className="block max-w-[240px]">
              <span className="block text-sm font-medium text-noir mb-1">Édition *</span>
              <select
                value={editionId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setEditionId(id);
                  setEditionYear(editions.find((ed) => ed.id === id)?.year ?? null);
                }}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              >
                {editions.map((e) => (
                  <option key={e.id} value={e.id}>{e.year}</option>
                ))}
              </select>
            </label>

            <SponsorIdentityFields
              value={form}
              // Editing the name invalidates the "already exists" notice: it was
              // about the previous one (#389).
              onChange={(next) => {
                if (next.name !== form.name) setExistingSponsorId(null);
                setForm(next);
              }}
            />
            <SponsorParticipationFields value={form} onChange={setForm} tiers={tiers} year={editionYear} />
          </div>
        ) : (
          <>
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              panelId={(key) => `sponsor-panel-${key}`}
            />

            <div
              id={`sponsor-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={0}
            >
              {activeTab === IDENTITY_TAB && (
                <section>
                  <h2 className="mb-1 text-lg font-semibold text-noir">Identité de l&apos;entreprise</h2>
                  <p className="mb-4 text-sm text-gris">
                    Partagée par toutes les éditions : une modification ici vaut pour chaque année.
                  </p>
                  <SponsorIdentityFields value={form} onChange={setForm} />
                </section>
              )}

              {activeTab === PARTICIPATION_TAB && (
                <section>
                  <h2 className="mb-1 text-lg font-semibold text-noir">
                    Participation{editionYear ? ` ${editionYear}` : ""}
                  </h2>
                  <p className="mb-4 text-sm text-gris">
                    Propre à cette édition : le niveau et le logo saisis ici ne touchent pas aux
                    autres années.
                  </p>
                  <SponsorYearPicker
                    participations={participations}
                    editionId={editionId}
                    onChange={requestYear}
                  />
                  <SponsorParticipationFields value={form} onChange={setForm} tiers={tiers} year={editionYear} />

                  {current && (
                    <div className="mt-8 border-t border-gris/20 pt-6">
                      <h2 className="mb-4 text-lg font-semibold text-noir">Éditions rattachées</h2>
                      <SponsorEditions sponsorId={current.id} tiers={tiers} />
                    </div>
                  )}
                </section>
              )}

              {activeTab === COM_KIT_TAB && (
                <section>
                  <h2 className="mb-1 text-lg font-semibold text-noir">
                    Kit de com{editionYear ? ` ${editionYear}` : ""}
                  </h2>
                  <p className="mb-4 text-sm text-gris">
                    Fourni par le sponsor pour cette édition. Jamais publié sur le site.
                  </p>
                  <SponsorYearPicker
                    participations={participations}
                    editionId={editionId}
                    onChange={requestYear}
                  />
                  <SponsorComKitFields value={form} onChange={setForm} tiers={tiers} year={editionYear} />
                </section>
              )}

              {activeTab === CONTACTS_TAB && current && (
                <section>
                  <h2 className="mb-1 text-lg font-semibold text-noir">Contacts &amp; accès</h2>
                  <p className="mb-4 text-sm text-gris">
                    Les personnes autorisées à modifier la fiche, rattachées à l&apos;entreprise.
                  </p>
                  <SponsorContacts sponsorId={current.id} />
                </section>
              )}
            </div>
          </>
        )}

        <ConfirmDialog
          isOpen={pendingYear !== null}
          title={`Passer à ${pendingYear?.edition.year ?? ""} ?`}
          message={`Les modifications non enregistrées de ${editionYear ?? "cette année"} seront perdues. Enregistrez d'abord si vous voulez les garder.`}
          confirmLabel="Changer d'année"
          variant="danger"
          onConfirm={() => {
            const next = pendingYear;
            setPendingYear(null);
            if (next) applyYear(next);
          }}
          onCancel={() => setPendingYear(null)}
        />

        {existingSponsorId !== null && (
          <div className="mt-4 rounded-lg border border-orange/40 bg-orange/10 p-3 text-sm text-noir">
            <p>
              <span className="font-medium">{form.name.trim()}</span>{" "}
              existe déjà. Une entreprise n&apos;est saisie qu&apos;une fois : rattachez-la à
              l&apos;édition{" "}
              <span className="font-medium">
                {editions.find((e) => e.id === editionId)?.year ?? "sélectionnée"}
              </span>{" "}
              plutôt que de la recréer.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={attachExisting}
                disabled={isSaving}
                className="rounded-lg bg-malachite px-3 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
              >
                Rattacher à cette édition
              </button>
              <button
                type="button"
                onClick={() => router.push(`/admin/sponsors/${existingSponsorId}`)}
                className="text-sm font-medium text-noir hover:underline"
              >
                Ouvrir la fiche existante
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-terre-cuite">{error}</p>}

        {/* Contacts save themselves on the spot, so the footer would promise
            something it does not do on that tab. */}
        {activeTab !== CONTACTS_TAB && (
          <div className="mt-6 border-t border-gris/20 pt-4">
            <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving || isSaveBlocked}
                className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
              >
                {isSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => router.push("/admin/sponsors")}
                className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
              >
                Annuler
              </button>
              {/* A greyed-out button explains nothing on its own (#393). On the
                  edit screen the blocking field may sit on a tab that is not
                  open, so the message names it; on create everything is on one
                  page and pointing at a tab would be a lie. */}
              {isSaveBlocked && (
                <span className="text-sm text-gris">
                  {!form.name.trim()
                    ? `Renseignez le nom${isNew ? "" : ", onglet Identité"}.`
                    : `Choisissez un niveau${isNew ? "" : ", onglet Participation"}.`}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
