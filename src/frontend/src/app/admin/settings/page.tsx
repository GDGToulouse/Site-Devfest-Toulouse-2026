"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";

const TABS = [
  { key: "contacts", label: "Contacts" },
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

  function togglePath(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }

  async function handlePurge() {
    const paths = [...selectedPaths];
    if (customPath.trim()) {
      paths.push(customPath.trim());
    }
    if (paths.length === 0) {
      setResult({ success: false, message: "Sélectionnez au moins un chemin" });
      return;
    }

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

  async function handlePurgeAll() {
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
            onClick={handlePurge}
            disabled={isPurging}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isPurging ? "Purge en cours..." : "Purger la sélection"}
          </button>
          <button
            onClick={handlePurgeAll}
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
  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
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
      {activeTab === "contacts" && <ContactsTab settings={settings} onSave={handleSave} />}
      {activeTab === "seo" && <SeoTab settings={settings} onSave={handleSave} />}
      {activeTab === "cache" && <CacheTab />}
    </div>
  );
}
