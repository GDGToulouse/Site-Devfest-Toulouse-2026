"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import BilingualInput from "@/components/admin/BilingualInput";
import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// Served by their own route and linked from every footer: the backend refuses
// to unpublish or trash them, and the UI hides the actions rather than letting
// an editor discover the refusal (#419).
const SYSTEM_SLUGS = ["code-de-conduite", "mentions-legales"];

type NavLocation = "NONE" | "HEADER" | "FOOTER";

const NAV_LABELS: Record<NavLocation, string> = {
  NONE: "Nulle part — accessible par son adresse uniquement",
  HEADER: "Menu principal",
  FOOTER: "Pied de page",
};

interface PageSummary {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  isPublished: boolean;
  navLocation: NavLocation;
  navOrder: number;
  updatedAt: string;
}

interface PageDetail extends PageSummary {
  contentFr: string;
  contentEn: string;
}

export default function PagesAdminPage() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [editing, setEditing] = useState<PageDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitleFr, setNewTitleFr] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [createError, setCreateError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [deleteTarget, setDeleteTarget] = useState<PageSummary | null>(null);
  const [listState, setListState] = useState<SaveState>(null);

  async function loadPages() {
    setIsLoading(true);
    const { data } = await adminFetch<PageSummary[]>("/pages");
    if (data) setPages(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadPages();
  }, []);

  async function handleCreate() {
    if (!newSlug.trim() || !newTitleFr.trim() || !newTitleEn.trim()) {
      setCreateError("Slug, titre FR et titre EN sont requis");
      return;
    }
    setCreateError("");
    setIsSaving(true);
    const { status, data } = await adminFetch<{ id: number }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        slug: newSlug.trim(),
        titleFr: newTitleFr.trim(),
        titleEn: newTitleEn.trim(),
        contentFr: "",
        contentEn: "",
      }),
    });
    setIsSaving(false);
    if (status === 409) {
      setCreateError("Une page avec ce slug existe déjà");
      return;
    }
    if (!data) {
      // Any other failure used to leave the form untouched and silent (#412).
      setCreateError("La création a échoué. Réessayez.");
      return;
    }
    setIsCreating(false);
    setNewSlug("");
    setNewTitleFr("");
    setNewTitleEn("");
    loadPages();
  }

  async function startEdit(page: PageSummary) {
    const { data } = await adminFetch<PageDetail>(`/pages/${page.id}`);
    if (data) setEditing(data);
  }

  async function handleSave() {
    if (!editing) return;
    setIsSaving(true);
    setSaveState(null);
    const { status } = await adminFetch(`/pages/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        titleFr: editing.titleFr,
        titleEn: editing.titleEn,
        contentFr: editing.contentFr,
        contentEn: editing.contentEn,
        isPublished: editing.isPublished,
        navLocation: editing.navLocation,
        navOrder: editing.navOrder,
      }),
    });
    setIsSaving(false);
    // Closing the editor regardless of the answer lost the edits and read as a
    // success (#412) — keep it open on failure so they can be retried.
    if (status !== 200) {
      setSaveState({ kind: "error", text: "L'enregistrement a échoué. Réessayez." });
      return;
    }
    setEditing(null);
    loadPages();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const { status } = await adminFetch(`/pages/${target.id}`, { method: "DELETE" });
    if (status !== 200) {
      setListState({
        kind: "error",
        text:
          status === 409
            ? "Cette page est servie par une route dédiée et ne peut pas être supprimée."
            : "La suppression a échoué. Réessayez.",
      });
      return;
    }
    setListState({ kind: "ok", text: `« ${target.titleFr} » est dans la corbeille.` });
    loadPages();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Pages de contenu</h1>
        {!editing && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
          >
            Nouvelle page
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">Nouvelle page</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="ma-page"
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Titre (FR)</label>
              <input
                type="text"
                value={newTitleFr}
                onChange={(e) => setNewTitleFr(e.target.value)}
                placeholder="Ma page"
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Title (EN)</label>
              <input
                type="text"
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
                placeholder="My page"
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
          </div>
          <p className="text-xs text-gris">
            La page est créée en brouillon. Elle ne sera visible qu&apos;une fois publiée depuis son
            écran de modification.
          </p>
          {createError && (
            <p role="alert" aria-live="assertive" className="text-sm text-terre-cuite">{createError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Création..." : "Créer"}
            </button>
            <button
              onClick={() => { setIsCreating(false); setCreateError(""); }}
              className="px-4 py-2 text-sm text-gris hover:text-noir"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-noir">Modifier : {editing.slug}</h2>
            <button onClick={() => setEditing(null)} className="text-sm text-gris hover:text-noir">Annuler</button>
          </div>

          <BilingualInput label="Titre" nameFr="titleFr" nameEn="titleEn" valueFr={editing.titleFr} valueEn={editing.titleEn} onChangeFr={(v) => setEditing({ ...editing, titleFr: v })} onChangeEn={(v) => setEditing({ ...editing, titleEn: v })} required />

          <BilingualTabs
            label="Contenu"
            isEmpty={(lang) => !(lang === "fr" ? editing.contentFr : editing.contentEn).replace(/<[^>]*>/g, "").trim()}
            renderPanel={(lang) =>
              lang === "fr" ? (
                <RichTextEditor label="" name="contentFr" value={editing.contentFr} onChange={(v) => setEditing({ ...editing, contentFr: v })} minHeight="400px" />
              ) : (
                <RichTextEditor label="" name="contentEn" value={editing.contentEn} onChange={(v) => setEditing({ ...editing, contentEn: v })} minHeight="400px" />
              )
            }
          />

          {SYSTEM_SLUGS.includes(editing.slug) ? (
            <p className="text-sm text-gris">
              Cette page a sa propre adresse et un lien permanent en pied de page : elle reste
              publiée.
            </p>
          ) : (
            <div className="rounded-lg border border-gris/20 p-4">
              <label className="flex items-center gap-3 text-sm text-noir">
                <input
                  type="checkbox"
                  checked={editing.isPublished}
                  onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
                  className="size-4 accent-malachite"
                />
                <span className="font-medium">Page publiée</span>
              </label>
              <p className="mt-2 text-xs text-gris">
                {editing.isPublished
                  ? `Visible de tous à l'adresse /${editing.slug}.`
                  : "Brouillon : la page répond 404 pour les visiteurs et n'apparaît pas au plan du site."}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <label htmlFor="navLocation" className="block text-sm font-medium text-noir mb-1">
                    Emplacement dans la navigation
                  </label>
                  <select
                    id="navLocation"
                    value={editing.navLocation}
                    onChange={(e) =>
                      setEditing({ ...editing, navLocation: e.target.value as NavLocation })
                    }
                    className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                  >
                    {(Object.keys(NAV_LABELS) as NavLocation[]).map((value) => (
                      <option key={value} value={value}>
                        {NAV_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="navOrder" className="block text-sm font-medium text-noir mb-1">
                    Ordre
                  </label>
                  <input
                    id="navOrder"
                    type="number"
                    value={editing.navOrder}
                    onChange={(e) =>
                      setEditing({ ...editing, navOrder: Number(e.target.value) || 0 })
                    }
                    className="w-24 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gris">
                Les pages s&apos;ajoutent après les entrées du site (Programme, Conférenciers,
                Sponsors…), du plus petit ordre au plus grand. Un brouillon n&apos;apparaît nulle
                part, quel que soit son emplacement.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <SaveFeedback state={listState} onDismiss={() => setListState(null)} />
          </div>
          <div className="overflow-x-auto overflow-y-hidden rounded-xl shadow-card bg-blanc">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse/60 border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Titre (FR)</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Mis à jour</th>
                  <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                    <td className="px-4 py-3 text-noir font-medium">/{page.slug}</td>
                    <td className="px-4 py-3 text-noir">{page.titleFr}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          page.isPublished
                            ? "inline-block rounded-full bg-malachite/15 px-2 py-0.5 text-xs font-medium text-malachite"
                            : "inline-block rounded-full bg-gris/15 px-2 py-0.5 text-xs font-medium text-gris"
                        }
                      >
                        {page.isPublished ? "Publiée" : "Brouillon"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gris text-xs">{new Date(page.updatedAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(page)} className="text-bleu hover:underline text-sm">Modifier</button>
                      {!SYSTEM_SLUGS.includes(page.slug) && (
                        <button
                          onClick={() => setDeleteTarget(page)}
                          className="ml-4 text-terre-cuite hover:underline text-sm"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer cette page ?"
        message={`« ${deleteTarget?.titleFr} » ira à la corbeille et ne sera plus accessible à l'adresse /${deleteTarget?.slug}. Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
