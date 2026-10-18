"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The articles' tags, maintained at last (#376). They are created on the fly
// from the article form; this screen renames, merges and removes them, with the
// number of articles each carries in view.

interface Tag {
  id: number;
  name: string;
  slug: string;
  articleCount: number;
}

type Action = { kind: "rename"; tag: Tag; name: string } | { kind: "merge"; tag: Tag; targetId: string };

const INPUT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

function articlesLabel(count: number): string {
  return count === 0 ? "aucun article" : `${count} article${count > 1 ? "s" : ""}`;
}

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [feedback, setFeedback] = useState<SaveState>(null);
  // A rename refused because the name is taken: the merge it most likely meant.
  const [mergeHint, setMergeHint] = useState<{ tag: Tag; targetId: number; targetName: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<Tag[]>("/tags");
    setTags(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tags ?? []).filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.slug.includes(needle));
  }, [tags, search]);

  async function submitAction() {
    if (!action) return;
    setFeedback(null);
    setMergeHint(null);

    if (action.kind === "rename") {
      const result = await adminFetch<Tag>(`/tags/${action.tag.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: action.name }),
      });
      if (result.status === 409 && typeof result.errorBody?.existingId === "number") {
        setMergeHint({
          tag: action.tag,
          targetId: result.errorBody.existingId,
          targetName: String(result.errorBody.existingName ?? ""),
        });
        setAction(null);
        return;
      }
      if (result.status !== 200) {
        setFeedback({ kind: "error", text: humanError(result, "Le renommage a échoué. Réessayez.") });
        return;
      }
      setFeedback({ kind: "ok", text: `Tag renommé en « ${action.name.trim()} ».` });
    } else {
      if (!action.targetId) return;
      const result = await adminFetch(`/tags/${action.tag.id}/merge`, {
        method: "POST",
        body: JSON.stringify({ targetId: Number(action.targetId) }),
      });
      if (result.status !== 200) {
        setFeedback({ kind: "error", text: humanError(result, "La fusion a échoué. Réessayez.") });
        return;
      }
      const target = tags?.find((t) => t.id === Number(action.targetId));
      setFeedback({ kind: "ok", text: `« ${action.tag.name} » fusionné dans « ${target?.name ?? "le tag choisi"} ».` });
    }
    setAction(null);
    await load();
  }

  async function mergeIntoExisting() {
    if (!mergeHint) return;
    setAction({ kind: "merge", tag: mergeHint.tag, targetId: String(mergeHint.targetId) });
    setMergeHint(null);
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    const { status } = await adminFetch(`/tags/${target.id}`, { method: "DELETE" });
    if (status !== 200) {
      setFeedback({ kind: "error", text: "La suppression a échoué. Réessayez." });
      return;
    }
    setFeedback({ kind: "ok", text: `« ${target.name} » est dans la corbeille.` });
    await load();
  }

  if (!tags) return <p className="text-gris">Chargement…</p>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-noir">Tags</h1>
        <p className="mt-1 text-sm text-gris">
          Les tags des articles. Ils se créent depuis le formulaire d&apos;un article ; ici, on les renomme, on fusionne
          les doublons et on retire ceux qui ne servent plus.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un tag…"
          className={`w-64 ${INPUT_CLASS}`}
        />
        <span className="text-sm text-gris" aria-live="polite">
          {visible.length} tag{visible.length > 1 ? "s" : ""}
        </span>
        <div className="ml-auto">
          <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
        </div>
      </div>

      {mergeHint && (
        <div role="status" className="mb-4 rounded-lg border border-orange/40 bg-orange/10 p-3 text-sm text-noir">
          <p>
            « {mergeHint.targetName} » existe déjà. Pour réunir les deux, fusionnez « {mergeHint.tag.name} » dans
            « {mergeHint.targetName} ».
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={mergeIntoExisting} className="rounded-lg bg-malachite px-3 py-1.5 text-sm font-medium text-blanc hover:bg-malachite/90">
              Préparer la fusion
            </button>
            <button type="button" onClick={() => setMergeHint(null)} className="text-sm text-gris hover:underline">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden rounded-xl bg-blanc shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gris/20 bg-blanc-casse/60">
              <th className="px-4 py-3 text-left font-medium text-gris">Tag</th>
              <th className="px-4 py-3 text-left font-medium text-gris">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gris">Articles</th>
              <th className="px-4 py-3 text-right font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tag) => {
              const isActive = action?.tag.id === tag.id;
              return (
                <tr key={tag.id} className="border-b border-gris/10 align-top hover:bg-blanc-casse/50">
                  <td className="px-4 py-3 font-medium text-noir">
                    {isActive && action.kind === "rename" ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitAction();
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          aria-label={`Nouveau nom pour ${tag.name}`}
                          value={action.name}
                          onChange={(e) => setAction({ ...action, name: e.target.value })}
                          autoFocus
                          className={INPUT_CLASS}
                        />
                        <button type="submit" disabled={!action.name.trim()} className="rounded-lg bg-malachite px-3 py-1.5 text-sm font-medium text-blanc disabled:opacity-50">
                          Renommer
                        </button>
                        <button type="button" onClick={() => setAction(null)} className="text-sm text-gris hover:underline">
                          Annuler
                        </button>
                      </form>
                    ) : (
                      tag.name
                    )}
                    {isActive && action.kind === "merge" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitAction();
                        }}
                        className="mt-2 flex flex-wrap items-center gap-2 font-normal"
                      >
                        <label className="text-sm text-gris" htmlFor={`merge-${tag.id}`}>
                          Fusionner dans
                        </label>
                        <select
                          id={`merge-${tag.id}`}
                          value={action.targetId}
                          onChange={(e) => setAction({ ...action, targetId: e.target.value })}
                          className={INPUT_CLASS}
                        >
                          <option value="">Choisir un tag…</option>
                          {tags
                            .filter((t) => t.id !== tag.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({articlesLabel(t.articleCount)})
                              </option>
                            ))}
                        </select>
                        <button type="submit" disabled={!action.targetId} className="rounded-lg bg-malachite px-3 py-1.5 text-sm font-medium text-blanc disabled:opacity-50">
                          Fusionner
                        </button>
                        <button type="button" onClick={() => setAction(null)} className="text-sm text-gris hover:underline">
                          Annuler
                        </button>
                        <span className="basis-full text-xs text-gris">
                          Ses {articlesLabel(tag.articleCount)} passeront sous le tag choisi ; « {tag.name} » ira à la corbeille.
                        </span>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gris">
                    <code className="text-xs">{tag.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-gris">{tag.articleCount}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setAction({ kind: "rename", tag, name: tag.name })} className="text-sm text-bleu hover:underline">
                      Renommer<span className="sr-only"> {tag.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction({ kind: "merge", tag, targetId: "" })}
                      className="ml-4 text-sm text-bleu hover:underline"
                    >
                      Fusionner<span className="sr-only"> {tag.name}</span>
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(tag)} className="ml-4 text-sm text-terre-cuite hover:underline">
                      Supprimer<span className="sr-only"> {tag.name}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gris">{search ? "Aucun tag ne correspond." : "Aucun tag."}</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer le tag"
        message={`Supprimer « ${deleteTarget?.name} » ? ${
          deleteTarget?.articleCount
            ? `${articlesLabel(deleteTarget.articleCount)} ne l'afficheront plus.`
            : "Aucun article ne l'utilise."
        } Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
