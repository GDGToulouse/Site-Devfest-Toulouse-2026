"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import BilingualInput from "@/components/admin/BilingualInput";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import FilePickerDialog from "@/components/admin/FilePickerDialog";

type SponsorPageStatus = "PRE_ANNOUNCEMENT" | "TEMPORARY" | "OPEN" | "SOLD_OUT";

interface EditionSettings {
  sponsorPageStatus: SponsorPageStatus;
  sponsorTemporaryFormUrl: string | null;
  sponsorBrochureUrl: string | null;
  sponsorHeroImageUrl: string | null;
}

const STATUS_OPTIONS: { value: SponsorPageStatus; label: string; hint: string }[] = [
  { value: "PRE_ANNOUNCEMENT", label: "Avant annonce", hint: "Affiche un message + CTA vers le formulaire temporaire (formulaire externe)." },
  { value: "TEMPORARY", label: "Annoncé (formulaire temporaire)", hint: "Affiche les plans + CTA vers le formulaire externe (la plaquette n'est pas encore prête)." },
  { value: "OPEN", label: "Ouvert (formulaire intégré)", hint: "Affiche tout : plans, plaquette téléchargeable, formulaire intégré." },
  { value: "SOLD_OUT", label: "Sponsoring complet", hint: "Affiche un message « tout est vendu » avec un lien vers /contact." },
];

interface SponsorPlan {
  id: number;
  nameFr: string;
  nameEn: string;
  subtitleFr: string | null;
  subtitleEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  price: string | null;
  standSize: string | null;
  advantages: { fr: string; en: string }[];
  color: string;
  isFeatured: boolean;
  isVisible: boolean;
  sortOrder: number;
}

const DEFAULT_COLORS = [
  { label: "Platinum (Emeraude)", value: "#41B38E" },
  { label: "Gold (Jaune)", value: "#FFD428" },
  { label: "Silver (Rose)", value: "#EE7CAD" },
  { label: "Malachite", value: "#109E6E" },
  { label: "Bleu", value: "#507BBD" },
  { label: "Terre cuite", value: "#EC6839" },
];

const emptyForm = {
  nameFr: "",
  nameEn: "",
  subtitleFr: "",
  subtitleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  price: "",
  standSize: "",
  advantages: [] as { fr: string; en: string }[],
  color: "#41B38E",
  isFeatured: false,
  isVisible: true,
  sortOrder: "0",
};

interface SponsoringTabProps {
  editionId: number;
}

export default function SponsoringTab({ editionId }: SponsoringTabProps) {
  const [plans, setPlans] = useState<SponsorPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SponsorPlan | null>(null);

  // Page settings (status, temporary form URL, brochure URL) — separate
  // from the plans list because they live on Edition, not on SponsorPlan.
  const [settings, setSettings] = useState<EditionSettings>({
    sponsorPageStatus: "PRE_ANNOUNCEMENT",
    sponsorTemporaryFormUrl: null,
    sponsorBrochureUrl: null,
    sponsorHeroImageUrl: null,
  });
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isBrochurePickerOpen, setIsBrochurePickerOpen] = useState(false);
  const [isHeroPickerOpen, setIsHeroPickerOpen] = useState(false);

  async function loadSettings() {
    const { data } = await adminFetch<EditionSettings>(`/editions/${editionId}`);
    if (data) {
      setSettings({
        sponsorPageStatus: data.sponsorPageStatus ?? "PRE_ANNOUNCEMENT",
        sponsorTemporaryFormUrl: data.sponsorTemporaryFormUrl ?? null,
        sponsorBrochureUrl: data.sponsorBrochureUrl ?? null,
        sponsorHeroImageUrl: data.sponsorHeroImageUrl ?? null,
      });
    }
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
        sponsorHeroImageUrl: settings.sponsorHeroImageUrl ?? "",
      }),
    });
    setIsSettingsSaving(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  async function loadPlans() {
    setIsLoading(true);
    const { data } = await adminFetch<SponsorPlan[]>(
      `/sponsor-plans?editionId=${editionId}`,
    );
    if (data) setPlans(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadPlans();
    loadSettings();
  }, [editionId]);

  function startNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function startEdit(plan: SponsorPlan) {
    setEditingId(plan.id);
    setForm({
      nameFr: plan.nameFr,
      nameEn: plan.nameEn,
      subtitleFr: plan.subtitleFr || "",
      subtitleEn: plan.subtitleEn || "",
      descriptionFr: plan.descriptionFr || "",
      descriptionEn: plan.descriptionEn || "",
      price: plan.price || "",
      standSize: plan.standSize || "",
      advantages: plan.advantages || [],
      color: plan.color,
      isFeatured: plan.isFeatured,
      isVisible: plan.isVisible,
      sortOrder: String(plan.sortOrder),
    });
    setShowForm(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const payload = {
      nameFr: form.nameFr,
      nameEn: form.nameEn,
      subtitleFr: form.subtitleFr || undefined,
      subtitleEn: form.subtitleEn || undefined,
      descriptionFr: form.descriptionFr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      price: form.price || undefined,
      standSize: form.standSize || undefined,
      advantages: form.advantages,
      color: form.color,
      isFeatured: form.isFeatured,
      isVisible: form.isVisible,
      sortOrder: Number(form.sortOrder) || 0,
      editionId,
    };

    if (editingId) {
      await adminFetch(`/sponsor-plans/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await adminFetch("/sponsor-plans", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    setIsSaving(false);
    setShowForm(false);
    loadPlans();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/sponsor-plans/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadPlans();
  }

  function addAdvantage() {
    setForm({
      ...form,
      advantages: [...form.advantages, { fr: "", en: "" }],
    });
  }

  function updateAdvantage(
    index: number,
    lang: "fr" | "en",
    value: string,
  ) {
    const updated = [...form.advantages];
    updated[index] = { ...updated[index], [lang]: value };
    setForm({ ...form, advantages: updated });
  }

  function removeAdvantage(index: number) {
    setForm({
      ...form,
      advantages: form.advantages.filter((_, i) => i !== index),
    });
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement...</p>;

  const currentStatusOption = STATUS_OPTIONS.find((o) => o.value === settings.sponsorPageStatus);
  const showTempUrl = settings.sponsorPageStatus === "PRE_ANNOUNCEMENT" || settings.sponsorPageStatus === "TEMPORARY";
  // Brochure is always editable — admins typically upload it before flipping
  // the page to OPEN, and the sponsor-brochure email template needs it
  // available regardless of the public page status.

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
          {currentStatusOption && (
            <p className="mt-1 text-xs text-gris">{currentStatusOption.hint}</p>
          )}
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

        {/* Custom hero image (optional). Falls back to the edition main hero
            on the public /devenir-sponsor page when empty. */}
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
              <img
                src={settings.sponsorHeroImageUrl}
                alt="Aperçu hero sponsor"
                className="h-24 rounded-lg object-cover"
              />
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

        <div>
          <label className="block text-sm font-medium text-noir mb-1">Plaquette sponsors (PDF)</label>
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
                Supprimer
              </button>
            )}
          </div>
          {settings.sponsorBrochureUrl && (
            <p className="mt-1 text-xs text-gris">{settings.sponsorBrochureUrl}</p>
          )}
          <FilePickerDialog
            open={isBrochurePickerOpen}
            onClose={() => setIsBrochurePickerOpen(false)}
            onSelect={(url) => setSettings({ ...settings, sponsorBrochureUrl: url })}
            title="Bibliothèque de plaquettes"
          />
        </div>

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

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-noir">Formules de sponsoring</h3>
        <button
          onClick={startNew}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          Nouvelle formule
        </button>
      </div>

      {showForm && (
        <div className="bg-blanc-casse/50 rounded-xl p-6 mb-6 space-y-4">
          <h4 className="text-sm font-bold text-noir">
            {editingId ? "Modifier la formule" : "Nouvelle formule"}
          </h4>

          <BilingualInput
            label="Nom"
            nameFr="nameFr"
            nameEn="nameEn"
            valueFr={form.nameFr}
            valueEn={form.nameEn}
            onChangeFr={(v) => setForm({ ...form, nameFr: v })}
            onChangeEn={(v) => setForm({ ...form, nameEn: v })}
            required
          />

          <BilingualInput
            label="Sous-titre"
            nameFr="subtitleFr"
            nameEn="subtitleEn"
            valueFr={form.subtitleFr}
            valueEn={form.subtitleEn}
            onChangeFr={(v) => setForm({ ...form, subtitleFr: v })}
            onChangeEn={(v) => setForm({ ...form, subtitleEn: v })}
          />

          <BilingualInput
            label="Description"
            nameFr="descriptionFr"
            nameEn="descriptionEn"
            valueFr={form.descriptionFr}
            valueEn={form.descriptionEn}
            onChangeFr={(v) => setForm({ ...form, descriptionFr: v })}
            onChangeEn={(v) => setForm({ ...form, descriptionEn: v })}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              label="Prix (ex: 5 000 EUR HT)"
              name="price"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
            />
            <FormField
              label="Taille du stand (ex: 12m\u00B2)"
              name="standSize"
              value={form.standSize}
              onChange={(v) => setForm({ ...form, standSize: v })}
            />
            <FormField
              label="Ordre"
              name="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(v) => setForm({ ...form, sortOrder: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c.value
                        ? "border-noir scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer border-0"
                  title="Couleur personnalisée"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={(e) =>
                    setForm({ ...form, isVisible: e.target.checked })
                  }
                  className="rounded border-gris/30 text-malachite focus:ring-malachite"
                />
                <span className="text-sm text-noir">Visible sur le site</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) =>
                    setForm({ ...form, isFeatured: e.target.checked })
                  }
                  className="rounded border-gris/30 text-malachite focus:ring-malachite"
                />
                <span className="text-sm text-noir">Formule à la une</span>
              </label>
            </div>
          </div>

          {/* Advantages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-noir">
                Avantages ({form.advantages.length})
              </label>
              <button
                type="button"
                onClick={addAdvantage}
                className="text-sm text-bleu hover:underline"
              >
                + Ajouter
              </button>
            </div>
            {form.advantages.map((adv, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="FR"
                  value={adv.fr}
                  onChange={(e) => updateAdvantage(i, "fr", e.target.value)}
                  className="flex-1 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
                <input
                  type="text"
                  placeholder="EN"
                  value={adv.en}
                  onChange={(e) => updateAdvantage(i, "en", e.target.value)}
                  className="flex-1 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
                <button
                  type="button"
                  onClick={() => removeAdvantage(i)}
                  className="text-terre-cuite hover:underline text-sm px-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="text-gris text-sm">
          Aucune formule de sponsoring pour cette édition.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gris/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blanc-casse/60 border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">
                  Couleur
                </th>
                <th className="text-left px-4 py-3 font-medium text-gris">
                  Nom
                </th>
                <th className="text-left px-4 py-3 font-medium text-gris">
                  Prix
                </th>
                <th className="text-left px-4 py-3 font-medium text-gris">
                  Stand
                </th>
                <th className="text-left px-4 py-3 font-medium text-gris">
                  Visible
                </th>
                <th className="text-right px-4 py-3 font-medium text-gris">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-gris/10 hover:bg-blanc-casse/50"
                >
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded-full"
                      style={{ backgroundColor: plan.color }}
                    />
                  </td>
                  <td className="px-4 py-3 text-noir font-medium">
                    {plan.nameFr}
                    {plan.subtitleFr && (
                      <span className="text-gris text-xs ml-2">
                        — {plan.subtitleFr}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-noir">{plan.price || "—"}</td>
                  <td className="px-4 py-3 text-noir">
                    {plan.standSize || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {plan.isVisible ? (
                      <span className="text-malachite text-xs font-medium">
                        Oui
                      </span>
                    ) : (
                      <span className="text-gris text-xs">Non</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startEdit(plan)}
                      className="text-bleu hover:underline text-sm"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(plan)}
                      className="text-terre-cuite hover:underline text-sm"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer la formule"
        message={`Supprimer "${deleteTarget?.nameFr}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
