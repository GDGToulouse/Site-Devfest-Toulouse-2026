"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const TABS = [
  { key: "identity", label: "Identité" },
  { key: "contacts", label: "Contacts" },
  { key: "ecosystem", label: "Écosystème" },
  { key: "seo", label: "SEO" },
  { key: "cache", label: "Cache" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Cache tab (moved from /admin/cache) ───────────────────────────

const PREDEFINED_PATHS = [
  { label: "Accueil", path: "/" },
  { label: "Articles", path: "/fr/actualites" },
  { label: "Billetterie", path: "/fr/billetterie" },
  { label: "Code de conduite", path: "/fr/code-de-conduite" },
  { label: "Mentions légales", path: "/fr/mentions-legales" },
  { label: "Contact", path: "/fr/contact" },
  { label: "CFP", path: "/fr/proposer-un-talk" },
];

function CacheTab() {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [customPath, setCustomPath] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmScope, setConfirmScope] = useState<"selection" | "all" | null>(null);

  function togglePath(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }

  function requestPurge() {
    const paths = [...selectedPaths];
    if (customPath.trim()) paths.push(customPath.trim());
    if (paths.length === 0) {
      setResult({ success: false, message: "Sélectionnez au moins un chemin" });
      return;
    }
    setConfirmScope("selection");
  }

  async function purgeSelection() {
    const paths = [...selectedPaths];
    if (customPath.trim()) paths.push(customPath.trim());

    setIsPurging(true);
    setResult(null);

    const { data, status } = await adminFetch<{ revalidated: boolean }>("/cache/purge", {
      method: "POST",
      body: JSON.stringify({ paths }),
    });

    setIsPurging(false);

    if (status === 200 && data?.revalidated) {
      setResult({ success: true, message: `Cache purgé pour ${paths.length} chemin(s)` });
      setSelectedPaths([]);
      setCustomPath("");
    } else {
      setResult({ success: false, message: "Erreur lors du purge du cache" });
    }
  }

  async function purgeAll() {
    setIsPurging(true);
    setResult(null);

    const allPaths = PREDEFINED_PATHS.map((p) => p.path);
    const { data, status } = await adminFetch<{ revalidated: boolean }>("/cache/purge", {
      method: "POST",
      body: JSON.stringify({ paths: allPaths }),
    });

    setIsPurging(false);

    if (status === 200 && data?.revalidated) {
      setResult({ success: true, message: "Cache complet purgé" });
    } else {
      setResult({ success: false, message: "Erreur lors du purge" });
    }
  }

  return (
    <>
      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <h2 className="text-lg font-bold text-noir mb-4">Purger des pages spécifiques</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {PREDEFINED_PATHS.map((item) => (
            <label key={item.path} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPaths.includes(item.path)}
                onChange={() => togglePath(item.path)}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="Chemin personnalisé (ex: /fr/actualites/mon-article)"
            className="flex-1 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={requestPurge}
            disabled={isPurging}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isPurging ? "Purge en cours..." : "Purger la sélection"}
          </button>
          <button
            onClick={() => setConfirmScope("all")}
            disabled={isPurging}
            className="px-4 py-2 bg-terre-cuite text-blanc rounded-lg text-sm font-medium hover:bg-terre-cuite/90 disabled:opacity-50"
          >
            Purger tout le cache
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-xl ${
            result.success ? "bg-malachite/10 text-malachite" : "bg-terre-cuite/10 text-terre-cuite"
          }`}
        >
          {result.message}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmScope !== null}
        title={confirmScope === "all" ? "Purger tout le cache ?" : "Purger les pages sélectionnées ?"}
        message={
          confirmScope === "all"
            ? "Tout le cache des pages publiques sera régénéré. Les visiteurs verront du contenu frais (re-rendu au prochain accès)."
            : "Les pages sélectionnées seront purgées et régénérées au prochain accès."
        }
        confirmLabel="Purger"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          const scope = confirmScope;
          setConfirmScope(null);
          if (scope === "all") void purgeAll();
          else void purgeSelection();
        }}
        onCancel={() => setConfirmScope(null)}
      />
    </>
  );
}

// ─── Contacts tab ──────────────────────────────────────────────────

function ContactsTab({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    contact_default_email: settings.contact_default_email || "",
    contact_webhook_url: settings.contact_webhook_url || "",
    social_linkedin: settings.social_linkedin || "",
    social_youtube: settings.social_youtube || "",
    social_x: settings.social_x || "",
    social_bluesky: settings.social_bluesky || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<string | null>(null);

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <h2 className="text-lg font-bold text-noir mb-4">Email de contact</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-noir mb-1">
            Email de fallback (formulaire de contact)
          </label>
          <input
            type="email"
            value={form.contact_default_email}
            onChange={(e) => handleChange("contact_default_email", e.target.value)}
            placeholder="contact@devfesttoulouse.fr"
            className="w-full max-w-md rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <p className="mt-1 text-xs text-gris">
            Utilisé quand aucune catégorie de contact n&apos;est définie ou n&apos;a de destinataire.
          </p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-noir mb-1">
            URL webhook contact
          </label>
          <input
            type="url"
            value={form.contact_webhook_url}
            onChange={(e) => handleChange("contact_webhook_url", e.target.value)}
            placeholder="https://hooks.example.com/..."
            className="w-full max-w-md rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <p className="mt-1 text-xs text-gris">
            URL appelée en POST à chaque soumission de formulaire de contact (toutes catégories). Laissez vide pour désactiver.
          </p>
          {form.contact_webhook_url && (
            <button
              type="button"
              onClick={async () => {
                setWebhookTestResult(null);
                const { adminFetch } = await import("@/lib/admin-api");
                const { data } = await adminFetch<{ status: string; responseStatus?: number; responseBody?: string }>(
                  "/settings/test-webhook",
                  { method: "POST", body: JSON.stringify({ url: form.contact_webhook_url }) }
                );
                if (data) {
                  setWebhookTestResult(data.status === "sent" ? `Envoyé (${data.responseStatus})` : `Échec : ${data.responseBody?.slice(0, 100)}`);
                } else {
                  setWebhookTestResult("Erreur");
                }
                setTimeout(() => setWebhookTestResult(null), 8000);
              }}
              className="mt-2 px-3 py-1 text-xs rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
            >
              Tester le webhook
            </button>
          )}
          {webhookTestResult && (
            <p className={`mt-1 text-xs ${webhookTestResult.startsWith("Envoyé") ? "text-malachite" : "text-terre-cuite"}`}>
              {webhookTestResult}
            </p>
          )}
        </div>

        <h2 className="text-lg font-bold text-noir mb-4">Réseaux sociaux</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-noir mb-1">LinkedIn</label>
            <input
              type="url"
              value={form.social_linkedin}
              onChange={(e) => handleChange("social_linkedin", e.target.value)}
              placeholder="https://www.linkedin.com/company/..."
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">YouTube</label>
            <input
              type="url"
              value={form.social_youtube}
              onChange={(e) => handleChange("social_youtube", e.target.value)}
              placeholder="https://www.youtube.com/@..."
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">X (Twitter)</label>
            <input
              type="url"
              value={form.social_x}
              onChange={(e) => handleChange("social_x", e.target.value)}
              placeholder="https://x.com/..."
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Bluesky</label>
            <input
              type="url"
              value={form.social_bluesky}
              onChange={(e) => handleChange("social_bluesky", e.target.value)}
              placeholder="https://bsky.app/profile/..."
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-malachite">Enregistré !</span>}
      </div>
    </form>
  );
}

// ─── Identity tab ──────────────────────────────────────────────────

interface AssetField {
  key: string;
  label: string;
  helpText: string;
}

const LOGO_FIELDS: AssetField[] = [
  {
    key: "identity_logo_main",
    label: "Logo principal (couleur)",
    helpText: "Format SVG conseillé (sinon PNG fond transparent ≥ 512px de large). Utilisé partout par défaut.",
  },
  {
    key: "identity_logo_white",
    label: "Logo blanc (fond foncé)",
    helpText: "Variante claire pour le footer et les fonds sombres. SVG recommandé, PNG transparent accepté.",
  },
  {
    key: "identity_logo_monochrome",
    label: "Logo monochrome (contrasté)",
    helpText: "Version noire ou contrastée pour impressions et contextes accessibilité. Optionnel.",
  },
  {
    key: "identity_logo_square",
    label: "Logo carré (header / avatars)",
    helpText: "Version compacte carrée pour le header et les avatars sociaux. PNG ou SVG ≥ 512×512.",
  },
];

const FAVICON_FIELDS: AssetField[] = [
  {
    key: "identity_favicon_ico",
    label: "Favicon (.ico)",
    helpText: "Format historique multi-tailles. 32×32 minimum, idéalement 16/32/48 multi-résolution. Toujours inclus comme dernier fallback.",
  },
  {
    key: "identity_favicon_svg",
    label: "Favicon SVG",
    helpText: "Vectoriel moderne (scalable, mode sombre). viewBox carré (32×32 ou similaire). Pris en priorité par les navigateurs récents.",
  },
  {
    key: "identity_favicon_png_192",
    label: "Icon PNG 192×192",
    helpText: "Pour PWA / Android. PNG carré exact 192×192.",
  },
  {
    key: "identity_favicon_png_512",
    label: "Icon PNG 512×512",
    helpText: "Pour PWA / splash screens. PNG carré exact 512×512.",
  },
  {
    key: "identity_apple_touch_icon",
    label: "Apple touch icon",
    helpText: "Pour l'icône iOS sur l'écran d'accueil. PNG carré exact 180×180, sans coins arrondis (iOS les ajoute).",
  },
];

function AssetPickerField({
  field,
  value,
  onChange,
}: {
  field: AssetField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div className="border border-gris/20 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-noir">{field.label}</p>
          <p className="text-xs text-gris mt-0.5">{field.helpText}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
          >
            {value ? "Changer" : "Choisir"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-sm text-terre-cuite hover:underline"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      {value && (
        <div className="flex items-center gap-3 pt-2 border-t border-gris/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={`Aperçu ${field.label}`}
            className="h-12 w-12 object-contain bg-blanc-casse rounded p-1"
          />
          <p className="text-xs text-gris font-mono break-all">{value}</p>
        </div>
      )}
      <ImagePickerDialog
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => { onChange(url); setIsPickerOpen(false); }}
      />
    </div>
  );
}

function IdentityTab({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const initial = [...LOGO_FIELDS, ...FAVICON_FIELDS].reduce(
    (acc, f) => ({ ...acc, [f.key]: settings[f.key] || "" }),
    {} as Record<string, string>,
  );
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <p className="text-sm text-gris mb-6">
          Tous les champs sont optionnels. Les valeurs vides utilisent les fichiers par défaut livrés
          avec le site (<code className="bg-blanc-casse px-1 rounded">/public/images/</code> et favicon embarqué).
          Téléversez vos fichiers depuis l&apos;onglet « Fichiers » avant de les sélectionner ici.
        </p>

        <h2 className="text-lg font-bold text-noir mb-4">Logos</h2>
        <div className="space-y-3 mb-6">
          {LOGO_FIELDS.map((field) => (
            <AssetPickerField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(v) => handleChange(field.key, v)}
            />
          ))}
        </div>

        <h2 className="text-lg font-bold text-noir mb-4">Favicon &amp; icônes</h2>
        <p className="text-xs text-gris mb-3">
          Les navigateurs choisissent automatiquement la meilleure résolution disponible.
          Le SVG est préféré quand il est défini ; sinon les PNG par taille ; le .ico sert toujours
          de dernier fallback.
        </p>
        <div className="space-y-3">
          {FAVICON_FIELDS.map((field) => (
            <AssetPickerField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(v) => handleChange(field.key, v)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-malachite">Enregistré !</span>}
      </div>
    </form>
  );
}

// ─── Ecosystem tab ─────────────────────────────────────────────────

interface EcosystemPartner {
  name: string;
  url: string;
  isFeatured: boolean;
}

function parsePartners(raw: string | undefined): EcosystemPartner[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p) => ({
        name: typeof p.name === "string" ? p.name : "",
        url: typeof p.url === "string" ? p.url : "",
        isFeatured: Boolean(p.isFeatured),
      }));
  } catch {
    return [];
  }
}

function EcosystemTab({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [partners, setPartners] = useState<EcosystemPartner[]>(() =>
    parsePartners(settings.ecosystem_partners),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePartner(index: number, patch: Partial<EcosystemPartner>) {
    setPartners((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setSaved(false);
    setError(null);
  }

  function setFeatured(index: number, value: boolean) {
    // Only one featured at a time: unset any other.
    setPartners((prev) =>
      prev.map((p, i) => ({ ...p, isFeatured: value && i === index })),
    );
    setSaved(false);
  }

  function addPartner() {
    setPartners((prev) => [...prev, { name: "", url: "", isFeatured: false }]);
    setSaved(false);
  }

  function removePartner(index: number) {
    setPartners((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= partners.length) return;
    setPartners((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = partners
      .map((p) => ({ ...p, name: p.name.trim(), url: p.url.trim() }))
      .filter((p) => p.name || p.url);

    for (const p of cleaned) {
      if (!p.name || !p.url) {
        setError("Chaque partenaire doit avoir un nom et une URL.");
        return;
      }
      try {
        new URL(p.url);
      } catch {
        setError(`URL invalide : ${p.url}`);
        return;
      }
    }

    setIsSaving(true);
    await onSave({ ecosystem_partners: JSON.stringify(cleaned) });
    setPartners(cleaned);
    setIsSaving(false);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <p className="text-sm text-gris mb-6">
          Partenaires de l&apos;écosystème affichés sur la page d&apos;accueil et dans le footer.
          Cochez « Mettre en avant » pour qu&apos;un partenaire apparaisse en bouton plein sur la
          page d&apos;accueil ; les autres sont affichés en bouton contour. Un seul partenaire peut
          être mis en avant à la fois.
        </p>

        {partners.length === 0 && (
          <p className="text-sm text-gris italic mb-4">Aucun partenaire configuré.</p>
        )}

        <ul className="space-y-3 mb-4">
          {partners.map((partner, index) => (
            <li
              key={index}
              className="border border-gris/20 rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-end"
            >
              <div className="flex-1">
                <label className="block text-xs font-medium text-gris mb-1">Nom</label>
                <input
                  type="text"
                  value={partner.name}
                  onChange={(e) => updatePartner(index, { name: e.target.value })}
                  placeholder="Toulouse Tech Hub"
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gris mb-1">URL</label>
                <input
                  type="url"
                  value={partner.url}
                  onChange={(e) => updatePartner(index, { url: e.target.value })}
                  placeholder="https://www.toulousetechhub.com"
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </div>
              <label className="flex items-center gap-2 whitespace-nowrap text-sm text-noir">
                <input
                  type="checkbox"
                  checked={partner.isFeatured}
                  onChange={(e) => setFeatured(index, e.target.checked)}
                  className="rounded border-gris/30 text-malachite focus:ring-malachite"
                />
                Mettre en avant
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Monter"
                  className="px-2 py-1 text-xs rounded border border-gris/30 text-noir hover:bg-blanc-casse disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === partners.length - 1}
                  title="Descendre"
                  className="px-2 py-1 text-xs rounded border border-gris/30 text-noir hover:bg-blanc-casse disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removePartner(index)}
                  title="Supprimer"
                  className="px-2 py-1 text-xs rounded border border-terre-cuite/30 text-terre-cuite hover:bg-terre-cuite/10"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addPartner}
          className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
        >
          + Ajouter un partenaire
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-malachite">Enregistré !</span>}
      </div>
    </form>
  );
}

// ─── SEO tab ───────────────────────────────────────────────────────

function SeoTab({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    seo_title_fr: settings.seo_title_fr || "",
    seo_title_en: settings.seo_title_en || "",
    seo_description_fr: settings.seo_description_fr || "",
    seo_description_en: settings.seo_description_en || "",
    seo_og_image: settings.seo_og_image || "",
    seo_keywords_fr: settings.seo_keywords_fr || "",
    seo_keywords_en: settings.seo_keywords_en || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <p className="text-sm text-gris mb-6">
          Ces valeurs sont utilisées par défaut quand une page, un article ou un sponsor ne définit
          pas ses propres métadonnées.
        </p>

        <h2 className="text-lg font-bold text-noir mb-4">Titre du site</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Titre (FR)</label>
            <input
              type="text"
              value={form.seo_title_fr}
              onChange={(e) => handleChange("seo_title_fr", e.target.value)}
              placeholder="DevFest Toulouse 2026"
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Title (EN)</label>
            <input
              type="text"
              value={form.seo_title_en}
              onChange={(e) => handleChange("seo_title_en", e.target.value)}
              placeholder="DevFest Toulouse 2026"
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
        </div>

        <h2 className="text-lg font-bold text-noir mb-4">Description</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Description (FR)</label>
            <textarea
              value={form.seo_description_fr}
              onChange={(e) => handleChange("seo_description_fr", e.target.value)}
              placeholder="La plus grande conférence tech du bassin toulousain..."
              rows={3}
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Description (EN)</label>
            <textarea
              value={form.seo_description_en}
              onChange={(e) => handleChange("seo_description_en", e.target.value)}
              placeholder="The largest tech conference in the Toulouse area..."
              rows={3}
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
          </div>
        </div>

        <h2 className="text-lg font-bold text-noir mb-4">Image Open Graph</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-noir mb-1">
            URL de l&apos;image par défaut
          </label>
          <input
            type="url"
            value={form.seo_og_image}
            onChange={(e) => handleChange("seo_og_image", e.target.value)}
            placeholder="https://devfesttoulouse.fr/og-image.jpg"
            className="w-full max-w-lg rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <p className="mt-1 text-xs text-gris">
            Dimensions recommandées : 1200x630 pixels. Utilisée sur les réseaux sociaux quand aucune image
            spécifique n&apos;est définie.
          </p>
        </div>

        <h2 className="text-lg font-bold text-noir mb-4">Mots-clés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Mots-clés (FR)</label>
            <input
              type="text"
              value={form.seo_keywords_fr}
              onChange={(e) => handleChange("seo_keywords_fr", e.target.value)}
              placeholder="devfest, toulouse, conference, tech, google"
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
            <p className="mt-1 text-xs text-gris">Séparés par des virgules.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-noir mb-1">Keywords (EN)</label>
            <input
              type="text"
              value={form.seo_keywords_en}
              onChange={(e) => handleChange("seo_keywords_en", e.target.value)}
              placeholder="devfest, toulouse, conference, tech, google"
              className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
            <p className="mt-1 text-xs text-gris">Comma-separated.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-malachite">Enregistré !</span>}
      </div>
    </form>
  );
}

// ─── Main page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("identity");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);
    const { data } = await adminFetch<Record<string, string>>("/settings/general");
    if (data) setSettings(data);
    setIsLoading(false);
  }

  async function handleSave(data: Record<string, string>) {
    await adminFetch("/settings/general", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setSettings((prev) => ({ ...prev, ...data }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gris">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-8">Paramètres généraux</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gris/20">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-malachite text-malachite"
                : "border-transparent text-gris hover:text-noir"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "identity" && <IdentityTab settings={settings} onSave={handleSave} />}
      {activeTab === "contacts" && <ContactsTab settings={settings} onSave={handleSave} />}
      {activeTab === "ecosystem" && <EcosystemTab settings={settings} onSave={handleSave} />}
      {activeTab === "seo" && <SeoTab settings={settings} onSave={handleSave} />}
      {activeTab === "cache" && <CacheTab />}
    </div>
  );
}
