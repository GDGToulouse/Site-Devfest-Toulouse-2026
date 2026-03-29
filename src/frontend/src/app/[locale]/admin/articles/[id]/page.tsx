"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import RichTextEditor from "@/components/admin/RichTextEditor";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import TagInput from "@/components/admin/TagInput";

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
  editionId: string;
  tagIds: number[];
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
  editionId: "",
  tagIds: [],
};

export default function ArticleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";
  const articleId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [activeLang, setActiveLang] = useState<"fr" | "en">("fr");
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    adminFetch<TagOption[]>("/tags").then(({ data }) => {
      if (data) setTags(data);
    });

    if (articleId) {
      adminFetch<ArticleForm & { tags: TagOption[] }>(`/articles/${articleId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/fr/admin/articles");
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
          editionId: data.editionId ? String(data.editionId) : "",
          tagIds: data.tags.map((t) => t.id),
        });
        setIsLoading(false);
      });
    }
  }, [articleId, router, isNew]);

  function updateForm(field: keyof ArticleForm, value: string | number[] | "DRAFT" | "PUBLISHED") {
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
      editionId: form.editionId ? Number(form.editionId) : undefined,
      tagIds: form.tagIds,
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
      setError("Un article avec ce slug existe deja");
      return;
    }

    if (!data) {
      setError("Erreur lors de la sauvegarde");
      return;
    }

    if (isNew) {
      router.push(`/fr/admin/articles/${data.id}`);
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
            onClick={() => router.push("/fr/admin/articles")}
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
              Generer
            </button>
          </div>

          <div className="flex gap-1 border-b border-gris/20">
            <button
              onClick={() => setActiveLang("fr")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
                activeLang === "fr"
                  ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
                  : "text-gris hover:text-noir"
              }`}
            >
              Francais
            </button>
            <button
              onClick={() => setActiveLang("en")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
                activeLang === "en"
                  ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
                  : "text-gris hover:text-noir"
              }`}
            >
              English
            </button>
          </div>

          <div className={activeLang === "fr" ? "space-y-4" : "hidden"}>
            <FormField label="Titre" name="titleFr" value={form.titleFr} onChange={(v) => updateForm("titleFr", v)} required />
            <FormField label="Extrait" name="excerptFr" value={form.excerptFr} onChange={(v) => updateForm("excerptFr", v)} multiline rows={2} />
            <RichTextEditor label="Contenu" name="contentFr" value={form.contentFr} onChange={(v) => updateForm("contentFr", v)} minHeight="320px" />
          </div>
          <div className={activeLang === "en" ? "space-y-4" : "hidden"}>
            <FormField label="Title" name="titleEn" value={form.titleEn} onChange={(v) => updateForm("titleEn", v)} required />
            <FormField label="Excerpt" name="excerptEn" value={form.excerptEn} onChange={(v) => updateForm("excerptEn", v)} multiline rows={2} />
            <RichTextEditor label="Content" name="contentEn" value={form.contentEn} onChange={(v) => updateForm("contentEn", v)} minHeight="320px" />
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
                  title="Choisir depuis la bibliotheque"
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
