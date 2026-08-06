"use client";

import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";
import FormField from "@/components/admin/FormField";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import FilePickerDialog from "@/components/admin/FilePickerDialog";

type SponsorPageStatus = "PRE_ANNOUNCEMENT" | "TEMPORARY" | "OPEN" | "SOLD_OUT";

interface EditionSettings {
  sponsorPageStatus: SponsorPageStatus;
  sponsorTemporaryFormUrl: string | null;
  sponsorBrochureUrl: string | null;
  sponsorBrochureUrlEn: string | null;
  sponsorHeroImageUrl: string | null;
}

const STATUS_OPTIONS: { value: SponsorPageStatus; label: string; hint: string }[] = [
  { value: "PRE_ANNOUNCEMENT", label: "Avant annonce", hint: "Affiche un message + CTA vers le formulaire temporaire (formulaire externe)." },
  { value: "TEMPORARY", label: "Annoncé (formulaire temporaire)", hint: "Affiche les offres + CTA vers le formulaire externe (la plaquette n'est pas encore prête)." },
  { value: "OPEN", label: "Ouvert (formulaire intégré)", hint: "Affiche tout : offres, plaquette téléchargeable, formulaire intégré." },
  { value: "SOLD_OUT", label: "Sponsoring complet", hint: "Affiche un message « tout est vendu » avec un lien vers /contact." },
];

// A catalogue tier merged with its (optional) binding to this edition (#320).
// A single "on /devenir-sponsor" checkbox drives the binding: checking it
// creates the link (visible), unchecking removes it. Price/order edit inline
// and save on blur.
interface EditionTierRow {
  tier: AdminSponsorTier;
  offered: boolean; // a live, visible join row exists for this edition
  price: string;
  sortOrder: string;
}

interface EditionTierLink {
  tierId: number;
  isVisible: boolean;
  price: string | null;
  sortOrder: number;
}

interface SponsoringTabProps {
  editionId: number;
}

export default function SponsoringTab({ editionId }: SponsoringTabProps) {
  const [rows, setRows] = useState<EditionTierRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTierId, setSavingTierId] = useState<number | null>(null);

  // Page settings (status, temporary form URL, brochure/hero) — live on Edition.
  const [settings, setSettings] = useState<EditionSettings>({
    sponsorPageStatus: "PRE_ANNOUNCEMENT",
    sponsorTemporaryFormUrl: null,
    sponsorBrochureUrl: null,
    sponsorBrochureUrlEn: null,
    sponsorHeroImageUrl: null,
  });
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isBrochurePickerOpen, setIsBrochurePickerOpen] = useState(false);
  const [isBrochureEnPickerOpen, setIsBrochureEnPickerOpen] = useState(false);
  const [isHeroPickerOpen, setIsHeroPickerOpen] = useState(false);

  async function loadSettings() {
    const { data } = await adminFetch<EditionSettings>(`/editions/${editionId}`);
    if (data) {
      setSettings({
        sponsorPageStatus: data.sponsorPageStatus ?? "PRE_ANNOUNCEMENT",
        sponsorTemporaryFormUrl: data.sponsorTemporaryFormUrl ?? null,
        sponsorBrochureUrl: data.sponsorBrochureUrl ?? null,
        sponsorBrochureUrlEn: data.sponsorBrochureUrlEn ?? null,
        sponsorHeroImageUrl: data.sponsorHeroImageUrl ?? null,
      });
    }
  }

  // Merge the whole catalogue with the edition's existing bindings: the
  // catalogue is the universe of tiers to offer, a binding carries the state.
  const loadTiers = useCallback(async () => {
    setIsLoading(true);
    const [catalogue, links] = await Promise.all([
      adminFetch<AdminSponsorTier[]>("/sponsor-tiers"),
      adminFetch<EditionTierLink[]>(`/editions/${editionId}/sponsor-tiers`),
    ]);
    const byTierId = new Map((links.data ?? []).map((l) => [l.tierId, l]));
    setRows(
      (catalogue.data ?? []).map((tier) => {
        const link = byTierId.get(tier.id);
        return {
          tier,
          offered: !!link,
          price: link?.price ?? "",
          sortOrder: String(link?.sortOrder ?? 0),
        };
      }),
    );
    setIsLoading(false);
  }, [editionId]);

  useEffect(() => {
    loadTiers();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  function patchRow(tierId: number, patch: Partial<EditionTierRow>) {
    setRows((prev) => prev.map((r) => (r.tier.id === tierId ? { ...r, ...patch } : r)));
  }

  // The single checkbox: checking publishes the offer on /devenir-sponsor (PUT
  // the link, visible), unchecking removes the link entirely.
  async function toggleOffered(row: EditionTierRow) {
    setSavingTierId(row.tier.id);
    if (row.offered) {
      await adminFetch(`/editions/${editionId}/sponsor-tiers/${row.tier.id}`, { method: "DELETE" });
      patchRow(row.tier.id, { offered: false });
    } else {
      await adminFetch(`/editions/${editionId}/sponsor-tiers/${row.tier.id}`, {
        method: "PUT",
        body: JSON.stringify({ isVisible: true, price: row.price || null, sortOrder: Number(row.sortOrder) || 0 }),
      });
      patchRow(row.tier.id, { offered: true });
    }
    setSavingTierId(null);
  }

  // Persist the price/order of an already-published offer, on blur.
  async function saveRow(row: EditionTierRow) {
    if (!row.offered) return;
    setSavingTierId(row.tier.id);
    await adminFetch(`/editions/${editionId}/sponsor-tiers/${row.tier.id}`, {
      method: "PUT",
      body: JSON.stringify({ isVisible: true, price: row.price || null, sortOrder: Number(row.sortOrder) || 0 }),
    });
    setSavingTierId(null);
  }

  async function saveSettings() {
    setIsSettingsSaving(true);
    setSettingsSaved(false);
    await adminFetch(`/editions/${editionId}`, {
      method: "PUT",
      body: JSON.stringify({
        sponsorPageStatus: settings.sponsorPageStatus,
        sponsorTemporaryFormUrl: settings.sponsorTemporaryFormUrl ?? "",
        sponsorBrochureUrl: settings.sponsorBrochureUrl ?? "",
        sponsorBrochureUrlEn: settings.sponsorBrochureUrlEn ?? "",
        sponsorHeroImageUrl: settings.sponsorHeroImageUrl ?? "",
      }),
    });
    setIsSettingsSaving(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement...</p>;

  const currentStatusOption = STATUS_OPTIONS.find((o) => o.value === settings.sponsorPageStatus);
  const showTempUrl = settings.sponsorPageStatus === "PRE_ANNOUNCEMENT" || settings.sponsorPageStatus === "TEMPORARY";

  return (
    <div>
      {/* Page settings */}
      <div className="bg-blanc-casse/50 rounded-xl p-6 mb-6 space-y-4">
        <h3 className="text-lg font-bold text-noir">Statut de la page « Devenir sponsor »</h3>
        <div>
          <label className="block text-sm font-medium text-noir mb-1">Statut</label>
          <select
            value={settings.sponsorPageStatus}
            onChange={(e) => setSettings({ ...settings, sponsorPageStatus: e.target.value as SponsorPageStatus })}
            className="w-full max-w-md rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {currentStatusOption && <p className="mt-1 text-xs text-gris">{currentStatusOption.hint}</p>}
        </div>

        {showTempUrl && (
          <FormField
            label="URL formulaire temporaire (Google Form, etc.)"
            name="sponsorTemporaryFormUrl"
            type="url"
            value={settings.sponsorTemporaryFormUrl || ""}
            onChange={(v) => setSettings({ ...settings, sponsorTemporaryFormUrl: v || null })}
            helpText="Lien externe affiché en CTA tant que la plaquette n'est pas finalisée."
          />
        )}

        {/* Custom hero image (optional). Falls back to the edition main hero on
            the public /devenir-sponsor page when empty. */}
        <div>
          <label className="block text-sm font-medium text-noir mb-1">
            Image d&apos;en-tête « Devenir sponsor » (optionnel)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsHeroPickerOpen(true)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
            >
              {settings.sponsorHeroImageUrl ? "Changer l'image" : "Choisir une image"}
            </button>
            {settings.sponsorHeroImageUrl && (
              <button
                type="button"
                onClick={() => setSettings({ ...settings, sponsorHeroImageUrl: null })}
                className="text-sm text-terre-cuite hover:underline"
              >
                Retirer (utiliser le hero général)
              </button>
            )}
          </div>
          {settings.sponsorHeroImageUrl ? (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.sponsorHeroImageUrl} alt="Aperçu hero sponsor" className="h-24 rounded-lg object-cover" />
              <p className="text-xs text-gris mt-1">{settings.sponsorHeroImageUrl}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gris">
              Si non définie, l&apos;image principale de l&apos;édition (onglet Général) est utilisée.
            </p>
          )}
          <ImagePickerDialog
            open={isHeroPickerOpen}
            onClose={() => setIsHeroPickerOpen(false)}
            onSelect={(url) => setSettings({ ...settings, sponsorHeroImageUrl: url })}
          />
        </div>

        {/* One brochure per language (#401): the tracked link in the
            confirmation email resolves the file from the locale the requester
            filled the form in. */}
        <fieldset>
          <legend className="block text-sm font-medium text-noir mb-1">Plaquette sponsors (PDF)</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-noir mb-1">Français</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBrochurePickerOpen(true)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
                >
                  {settings.sponsorBrochureUrl ? "Changer le fichier" : "Choisir un fichier"}
                </button>
                {settings.sponsorBrochureUrl && (
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, sponsorBrochureUrl: null })}
                    className="text-sm text-terre-cuite hover:underline"
                  >
                    Supprimer <span className="sr-only">la plaquette française</span>
                  </button>
                )}
              </div>
              {settings.sponsorBrochureUrl && <p className="mt-1 text-xs text-gris">{settings.sponsorBrochureUrl}</p>}
            </div>

            <div>
              <p className="text-sm text-noir mb-1">Anglais (optionnel)</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBrochureEnPickerOpen(true)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
                >
                  {settings.sponsorBrochureUrlEn ? "Changer le fichier" : "Choisir un fichier"}
                </button>
                {settings.sponsorBrochureUrlEn && (
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, sponsorBrochureUrlEn: null })}
                    className="text-sm text-terre-cuite hover:underline"
                  >
                    Supprimer <span className="sr-only">la plaquette anglaise</span>
                  </button>
                )}
              </div>
              {settings.sponsorBrochureUrlEn && <p className="mt-1 text-xs text-gris">{settings.sponsorBrochureUrlEn}</p>}
            </div>
          </div>
          {!settings.sponsorBrochureUrlEn && (
            <p className="mt-2 text-xs text-gris">
              Sans plaquette anglaise, les demandes faites en anglais reçoivent la plaquette française.
            </p>
          )}
          <FilePickerDialog
            open={isBrochurePickerOpen}
            onClose={() => setIsBrochurePickerOpen(false)}
            onSelect={(url) => setSettings({ ...settings, sponsorBrochureUrl: url })}
            title="Bibliothèque de plaquettes — français"
          />
          <FilePickerDialog
            open={isBrochureEnPickerOpen}
            onClose={() => setIsBrochureEnPickerOpen(false)}
            onSelect={(url) => setSettings({ ...settings, sponsorBrochureUrlEn: url })}
            title="Bibliothèque de plaquettes — anglais"
          />
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSettingsSaving}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSettingsSaving ? "Sauvegarde..." : "Enregistrer le statut"}
          </button>
          {settingsSaved && <span className="text-sm text-malachite">Enregistré !</span>}
        </div>
      </div>

      {/* Which catalogue offers appear on this edition's /devenir-sponsor (#320).
          One checkbox = published & visible; price/order save on blur. Editing a
          tier's name/colour/advantages is done in the catalogue (#319). */}
      <div className="mb-2">
        <h3 className="text-lg font-bold text-noir">Offres sur « Devenir sponsor »</h3>
        <p className="text-sm text-gris">
          Cochez les offres du catalogue à publier pour cette édition, et fixez leur tarif et leur ordre
          d&apos;affichage. Le catalogue lui-même se gère dans « Offres de sponsoring ».
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gris text-sm">
          Aucune offre dans le catalogue. Créez-en dans « Offres de sponsoring » avant de les publier ici.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse/60 border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Sur /devenir-sponsor</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Offre</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Tarif (édition)</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Ordre</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tier.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={row.offered}
                        disabled={savingTierId === row.tier.id}
                        onChange={() => toggleOffered(row)}
                        className="rounded border-gris/30 text-malachite focus:ring-malachite"
                        aria-label={`Publier ${row.tier.nameFr} sur /devenir-sponsor`}
                      />
                    </td>
                    <td className="px-4 py-3 text-noir font-medium">
                      <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ backgroundColor: row.tier.color }} />
                      {row.tier.nameFr}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.price}
                        disabled={!row.offered}
                        placeholder="—"
                        onChange={(e) => patchRow(row.tier.id, { price: e.target.value })}
                        onBlur={() => saveRow(row)}
                        className="w-32 rounded-lg border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.sortOrder}
                        disabled={!row.offered}
                        onChange={(e) => patchRow(row.tier.id, { sortOrder: e.target.value })}
                        onBlur={() => saveRow(row)}
                        className="w-16 rounded-lg border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-40"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.some((r) => r.offered) && (
            <p className="mt-3 text-sm text-gris">
              Aucune offre publiée : la section des formules restera masquée sur « Devenir sponsor ».
            </p>
          )}
        </>
      )}
    </div>
  );
}
