"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import RichTextEditor from "@/components/admin/RichTextEditor";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import TagInput from "@/components/admin/TagInput";
import Tabs from "@/components/admin/Tabs";

interface ArticleForm {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  excerptFr: string;
  excerptEn: string;
  imageUrl: string;
  author: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
  editionIds: number[];
  tagIds: number[];
  // AI-translation flags. They drive the badge in the editor and let the
  // editor mark a field as reviewed (clear the flag without resaving).
  autoTranslatedFr: boolean;
  autoTranslatedEn: boolean;
  translatedAtFr: string | null;
  translatedAtEn: string | null;
}

interface TagOption {
  id: number;
  name: string;
  slug: string;
}

const emptyForm: ArticleForm = {
  slug: "",
  titleFr: "",
  titleEn: "",
  contentFr: "",
  contentEn: "",
  excerptFr: "",
  excerptEn: "",
  imageUrl: "",
  author: "",
  publicationStatus: "DRAFT",
  editionIds: [],
  tagIds: [],
  autoTranslatedFr: false,
  autoTranslatedEn: false,
  translatedAtFr: null,
  translatedAtEn: null,
};

export default function ArticleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";
  const articleId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [activeLang, setActiveLang] = useState<"fr" | "en">("fr");
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    adminFetch<TagOption[]>("/tags").then(({ data }) => {
      if (data) setTags(data);
    });

    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      if (data) setEditions(data);
    });

    if (articleId) {
      reloadArticle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, router, isNew]);

  async function reloadArticle() {
    if (!articleId) return;
    const { data, status } = await adminFetch<ArticleForm & {
      tags: TagOption[];
      editions: { id: number; year: number }[];
    }>(`/articles/${articleId}`);
    if (status === 404 || !data) {
      router.push(`/admin/articles`);
      return;
    }
    setForm({
      slug: data.slug,
      titleFr: data.titleFr,
      titleEn: data.titleEn,
      contentFr: data.contentFr,
      contentEn: data.contentEn,
      excerptFr: data.excerptFr || "",
      excerptEn: data.excerptEn || "",
      imageUrl: data.imageUrl || "",
      author: data.author || "",
      publicationStatus: data.publicationStatus,
      editionIds: data.editions?.map((e: { id: number }) => e.id) || [],
      tagIds: data.tags.map((t) => t.id),
      autoTranslatedFr: data.autoTranslatedFr ?? false,
      autoTranslatedEn: data.autoTranslatedEn ?? false,
      translatedAtFr: data.translatedAtFr ?? null,
      translatedAtEn: data.translatedAtEn ?? null,
    });
    setIsLoading(false);
  }

  function updateForm(field: keyof ArticleForm, value: string | number[] | "DRAFT" | "PUBLISHED" | boolean | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function generateSlug() {
    const slug = form.titleFr
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    updateForm("slug", slug);
  }

  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Translates the OTHER language from the currently active one and writes
  // the result on the article. Only enabled when:
  //   - article is saved (we need an id to call the endpoint)
  //   - source title is non-empty (no point translating nothing)
  // The endpoint persists the result and sets the auto-translated flag,
  // so we just reload to refresh the form state.
  async function handleTranslate() {
    if (!articleId) return;
    const from = activeLang;
    const to = from === "fr" ? "en" : "fr";

    if (!confirm(
      `Traduire automatiquement le contenu ${from.toUpperCase()} vers ${to.toUpperCase()} ?\n\n` +
      `Le contenu ${to.toUpperCase()} actuel sera écrasé. Vous pourrez le relire et le corriger ensuite.`,
    )) return;

    setIsTranslating(true);
    setTranslateError(null);

    const { status, data } = await adminFetch<{ error?: string; message?: string }>(
      `/articles/${articleId}/translate-fields`,
      { method: "POST", body: JSON.stringify({ from }) },
    );

    setIsTranslating(false);

    if (status === 503) {
      setTranslateError("Service de traduction non configuré (clé API Gemini manquante).");
      return;
    }
    if (status === 429) {
      setTranslateError("Quota de traduction atteint. Réessayez plus tard.");
      return;
    }
    if (status === 422) {
      setTranslateError("La traduction a cassé la structure du contenu. Réessayez ou corrigez manuellement.");
      return;
    }
    if (status >= 400) {
      setTranslateError(data?.message || "La traduction a échoué.");
      return;
    }

    // Switch the editor to the freshly filled language so the editor sees
    // the result immediately, then reload from the server to pick up the
    // persisted flag + content.
    setActiveLang(to);
    await reloadArticle();
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    const payload = {
      slug: form.slug,
      titleFr: form.titleFr,
      titleEn: form.titleEn,
      contentFr: form.contentFr,
      contentEn: form.contentEn,
      excerptFr: form.excerptFr || undefined,
      excerptEn: form.excerptEn || undefined,
      imageUrl: form.imageUrl || undefined,
      author: form.author || undefined,
      publicationStatus: form.publicationStatus,
      editionIds: form.editionIds,
      tagIds: form.tagIds,
      autoTranslatedFr: form.autoTranslatedFr,
      autoTranslatedEn: form.autoTranslatedEn,
    };

    const { data, status } = isNew
      ? await adminFetch<{ id: number }>("/articles", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      : await adminFetch<{ id: number }>(`/articles/${articleId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

    setIsSaving(false);

    if (status === 409) {
      setError("Un article avec ce slug existe déjà");
      return;
    }

    if (!data) {
      setError("Erreur lors de la sauvegarde");
      return;
    }

    if (isNew) {
      router.push(`/admin/articles/${data.id}`);
    }
  }

  if (isLoading) {
    return <p className="text-gris">Chargement...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">
          {isNew ? "Nouvel article" : "Modifier l'article"}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/admin/articles`)}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Retour
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

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      <div className="space-y-6">
        <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <FormField label="Slug" name="slug" value={form.slug} onChange={(v) => updateForm("slug", v)} required />
            </div>
            <button
              onClick={generateSlug}
              className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
            >
              Générer
            </button>
          </div>

          <div className="flex items-end justify-between gap-4">
            {/* Language tabs via the shared accessible Tabs (role, aria-controls,
                arrow-key nav). The "auto" marker rides in the label so the
                machine-translated language stays visible on its tab. */}
            <div className="flex-1">
              <Tabs
                tabs={[
                  { key: "fr", label: form.autoTranslatedFr ? "Français · auto" : "Français" },
                  { key: "en", label: form.autoTranslatedEn ? "English · auto" : "English" },
                ]}
                activeTab={activeLang}
                onTabChange={(key) => setActiveLang(key as "fr" | "en")}
                panelId={(key) => `article-panel-${key}`}
              />
            </div>

            {/* Translate button: source = active tab, target = the other one */}
            {!isNew && (
              <button
                type="button"
                onClick={handleTranslate}
                disabled={isTranslating || !form.titleFr.trim() && activeLang === "fr" || !form.titleEn.trim() && activeLang === "en"}
                className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-bleu/30 text-bleu hover:bg-bleu/5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Traduire le contenu ${activeLang.toUpperCase()} vers ${activeLang === "fr" ? "EN" : "FR"} via Gemini`}
              >
                {isTranslating ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                    Traduction…
                  </>
                ) : (
                  <>
                    Traduire {activeLang === "fr" ? "FR → EN" : "EN → FR"}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Translation outcome banner */}
          {translateError && (
            <div className="px-4 py-2 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">
              {translateError}
            </div>
          )}
          {!isNew && (form.autoTranslatedFr || form.autoTranslatedEn) && (
            <p className="text-xs text-gris italic">
              Astuce : si vous avez relu et corrigé une langue marquée « auto », décochez la case ci-dessous pour retirer le badge.
            </p>
          )}

          <div
            id="article-panel-fr"
            role="tabpanel"
            aria-labelledby="tab-fr"
            className={activeLang === "fr" ? "space-y-4" : "hidden"}
          >
            <FormField label="Titre" name="titleFr" value={form.titleFr} onChange={(v) => updateForm("titleFr", v)} required />
            <FormField label="Extrait" name="excerptFr" value={form.excerptFr} onChange={(v) => updateForm("excerptFr", v)} multiline rows={2} />
            <RichTextEditor label="Contenu" name="contentFr" value={form.contentFr} onChange={(v) => updateForm("contentFr", v)} minHeight="320px" />
            {form.autoTranslatedFr && (
              <label className="flex items-center gap-2 text-sm text-gris">
                <input
                  type="checkbox"
                  checked={form.autoTranslatedFr}
                  onChange={(e) => updateForm("autoTranslatedFr", e.target.checked)}
                  className="rounded border-gris/30"
                />
                <span>Contenu généré par IA (décocher après relecture pour retirer le badge sur le site)</span>
              </label>
            )}
          </div>
          <div
            id="article-panel-en"
            role="tabpanel"
            aria-labelledby="tab-en"
            className={activeLang === "en" ? "space-y-4" : "hidden"}
          >
            <FormField label="Title" name="titleEn" value={form.titleEn} onChange={(v) => updateForm("titleEn", v)} required />
            <FormField label="Excerpt" name="excerptEn" value={form.excerptEn} onChange={(v) => updateForm("excerptEn", v)} multiline rows={2} />
            <RichTextEditor label="Content" name="contentEn" value={form.contentEn} onChange={(v) => updateForm("contentEn", v)} minHeight="320px" />
            {form.autoTranslatedEn && (
              <label className="flex items-center gap-2 text-sm text-gris">
                <input
                  type="checkbox"
                  checked={form.autoTranslatedEn}
                  onChange={(e) => updateForm("autoTranslatedEn", e.target.checked)}
                  className="rounded border-gris/30"
                />
                <span>AI-generated content (uncheck after review to remove the badge on the site)</span>
              </label>
            )}
          </div>
        </div>

        <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">Metadata</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <FormField label="Image URL" name="imageUrl" type="url" value={form.imageUrl} onChange={(v) => updateForm("imageUrl", v)} />
              </div>
              <div className="shrink-0">
                <span className="block text-sm font-medium text-transparent mb-1">&nbsp;</span>
                <button
                  onClick={() => setShowImagePicker(true)}
                  className="flex items-center justify-center px-3 h-[42px] rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
                  title="Choisir depuis la bibliothèque"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </button>
              </div>
            </div>
            <FormField label="Auteur" name="author" value={form.author} onChange={(v) => updateForm("author", v)} />
          </div>

          <ImagePickerDialog
            open={showImagePicker}
            onClose={() => setShowImagePicker(false)}
            onSelect={(url) => {
              updateForm("imageUrl", url);
              setShowImagePicker(false);
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Statut</label>
              <select
                value={form.publicationStatus}
                onChange={(e) => updateForm("publicationStatus", e.target.value as "DRAFT" | "PUBLISHED")}
                className="rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              >
                <option value="DRAFT">Brouillon</option>
                <option value="PUBLISHED">Publié</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Éditions</label>
              <div className="flex flex-wrap gap-2">
                {editions.map((ed) => {
                  const isSelected = form.editionIds.includes(ed.id);
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      onClick={() => {
                        const newIds = isSelected
                          ? form.editionIds.filter((id) => id !== ed.id)
                          : [...form.editionIds, ed.id];
                        updateForm("editionIds", newIds);
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-malachite text-blanc border-malachite"
                          : "bg-blanc text-gris border-gris/30 hover:border-malachite hover:text-malachite"
                      }`}
                    >
                      DevFest {ed.year}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <TagInput
            allTags={tags}
            selectedTagIds={form.tagIds}
            onChange={(tagIds) => updateForm("tagIds", tagIds)}
            onTagCreated={(tag) => setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
          />
        </div>
      </div>
    </div>
  );
}
