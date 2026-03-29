"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";

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

  function toggleTag(tagId: number) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
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

          {activeLang === "fr" ? (
            <div className="space-y-4">
              <FormField label="Titre" name="titleFr" value={form.titleFr} onChange={(v) => updateForm("titleFr", v)} required />
              <FormField label="Extrait" name="excerptFr" value={form.excerptFr} onChange={(v) => updateForm("excerptFr", v)} multiline rows={2} />
              <FormField label="Contenu" name="contentFr" value={form.contentFr} onChange={(v) => updateForm("contentFr", v)} multiline rows={12} />
            </div>
          ) : (
            <div className="space-y-4">
              <FormField label="Title" name="titleEn" value={form.titleEn} onChange={(v) => updateForm("titleEn", v)} required />
              <FormField label="Excerpt" name="excerptEn" value={form.excerptEn} onChange={(v) => updateForm("excerptEn", v)} multiline rows={2} />
              <FormField label="Content" name="contentEn" value={form.contentEn} onChange={(v) => updateForm("contentEn", v)} multiline rows={12} />
            </div>
          )}
        </div>

        <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">Metadata</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Image URL" name="imageUrl" type="url" value={form.imageUrl} onChange={(v) => updateForm("imageUrl", v)} />
            <FormField label="Auteur" name="author" value={form.author} onChange={(v) => updateForm("author", v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-noir mb-1">Statut</label>
            <select
              value={form.publicationStatus}
              onChange={(e) => updateForm("publicationStatus", e.target.value as "DRAFT" | "PUBLISHED")}
              className="rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publie</option>
            </select>
          </div>

          {tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-noir mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      form.tagIds.includes(tag.id)
                        ? "bg-malachite text-blanc"
                        : "bg-blanc-casse text-gris hover:bg-gris/10"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
