"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import BilingualInput from "@/components/admin/BilingualInput";
import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// The FAQ in the back-office (#111): questions grouped by theme as the public
// page shows them, reordered with the arrows, written in both languages.

type Theme = "VENUE" | "TICKETS" | "PROGRAMME" | "PRACTICAL" | "OTHER";

const THEMES: { value: Theme; label: string }[] = [
  { value: "VENUE", label: "Lieu et accès" },
  { value: "TICKETS", label: "Billetterie" },
  { value: "PROGRAMME", label: "Programme et sessions" },
  { value: "PRACTICAL", label: "Sur place" },
  { value: "OTHER", label: "Autres questions" },
];

interface FaqItem {
  id: number;
  theme: Theme;
  questionFr: string;
  questionEn: string;
  answerFr: string;
  answerEn: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
}

const EMPTY: Omit<FaqItem, "id"> = {
  theme: "OTHER",
  questionFr: "",
  questionEn: "",
  answerFr: "",
  answerEn: "",
  publicationStatus: "DRAFT",
};

const isBlank = (html: string) => !html.replace(/<[^>]*>/g, "").trim();

export default function FaqAdminPage() {
  const [items, setItems] = useState<FaqItem[] | null>(null);
  // The question being written: an existing one, or a new one (no id).
  const [editing, setEditing] = useState<(Omit<FaqItem, "id"> & { id?: number }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [listState, setListState] = useState<SaveState>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<FaqItem[]>("/faq");
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!editing) return;
    if (!editing.questionFr.trim()) {
      setSaveState({ kind: "error", text: "La question en français est obligatoire." });
      return;
    }
    setIsSaving(true);
    const { id, ...body } = editing;
    const result = await adminFetch<FaqItem>(id ? `/faq/${id}` : "/faq", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    setIsSaving(false);
    if (result.status !== 200 && result.status !== 201) {
      setSaveState({ kind: "error", text: humanError(result, "La question n'a pas pu être enregistrée.") });
      return;
    }
    setEditing(null);
    setListState({ kind: "ok", text: id ? "Question enregistrée." : "Question ajoutée." });
    await load();
  }

  // Swaps a question with its neighbour inside its theme, then saves the order.
  async function move(item: FaqItem, direction: -1 | 1) {
    if (!items) return;
    const sameTheme = items.filter((i) => i.theme === item.theme);
    const index = sameTheme.findIndex((i) => i.id === item.id);
    const other = sameTheme[index + direction];
    if (!other) return;
    const reordered = items.map((i) => (i.id === item.id ? other : i.id === other.id ? item : i));
    setItems(reordered);
    const result = await adminFetch("/faq/order", {
      method: "PUT",
      body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
    });
    if (result.status !== 200) {
      setListState({ kind: "error", text: humanError(result, "Le nouvel ordre n'a pas pu être enregistré.") });
      await load();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await adminFetch(`/faq/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (result.status !== 204) {
      setListState({ kind: "error", text: humanError(result, "La question n'a pas pu être supprimée.") });
      return;
    }
    setListState({ kind: "ok", text: "Question envoyée à la corbeille." });
    await load();
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">FAQ</h1>
          <p className="mt-1 text-sm text-gris">
            Les questions publiées apparaissent sur la page « Questions fréquentes », groupées par thème, dans
            l&apos;ordre ci-dessous. La page entre dans le menu dès la première question publiée.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setSaveState(null);
              setEditing({ ...EMPTY });
            }}
            className="shrink-0 rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90"
          >
            + Ajouter une question
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4 rounded-xl bg-blanc p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-noir">{editing.id ? "Modifier la question" : "Nouvelle question"}</h2>
            <button onClick={() => setEditing(null)} className="text-sm text-gris hover:text-noir">
              Annuler
            </button>
          </div>

          <div>
            <label htmlFor="faq-theme" className="mb-1 block text-sm font-medium text-noir">
              Thème
            </label>
            <select
              id="faq-theme"
              value={editing.theme}
              onChange={(e) => setEditing({ ...editing, theme: e.target.value as Theme })}
              className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              {THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>

          <BilingualInput
            label="Question"
            nameFr="questionFr"
            nameEn="questionEn"
            valueFr={editing.questionFr}
            valueEn={editing.questionEn}
            onChangeFr={(v) => setEditing({ ...editing, questionFr: v })}
            onChangeEn={(v) => setEditing({ ...editing, questionEn: v })}
            required
          />

          <BilingualTabs
            label="Réponse"
            isEmpty={(lang) => isBlank(lang === "fr" ? editing.answerFr : editing.answerEn)}
            renderPanel={(lang) =>
              lang === "fr" ? (
                <RichTextEditor label="" name="answerFr" value={editing.answerFr} onChange={(v) => setEditing({ ...editing, answerFr: v })} minHeight="160px" />
              ) : (
                <RichTextEditor label="" name="answerEn" value={editing.answerEn} onChange={(v) => setEditing({ ...editing, answerEn: v })} minHeight="160px" />
              )
            }
          />
          <p className="text-xs text-gris">
            Sans traduction anglaise, la page anglaise affiche la question et la réponse en français.
          </p>

          <label className="flex items-center gap-3 text-sm text-noir">
            <input
              type="checkbox"
              checked={editing.publicationStatus === "PUBLISHED"}
              onChange={(e) => setEditing({ ...editing, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
              className="size-4 accent-malachite"
            />
            <span className="font-medium">Question publiée</span>
          </label>

          <div className="flex items-center justify-end gap-3">
            <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : items === null ? (
        <p className="text-gris">Chargement...</p>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <SaveFeedback state={listState} onDismiss={() => setListState(null)} />
          </div>
          {items.length === 0 && <p className="text-gris">Aucune question pour le moment.</p>}
          {THEMES.map(({ value, label }) => {
            const questions = items.filter((item) => item.theme === value);
            if (questions.length === 0) return null;
            return (
              <section key={value} className="mb-8">
                <h2 className="mb-3 text-lg font-bold text-noir">{label}</h2>
                <ul className="space-y-2">
                  {questions.map((item, index) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-blanc px-4 py-3 shadow-card">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(item, -1)}
                          disabled={index === 0}
                          aria-label={`Monter « ${item.questionFr} »`}
                          className="px-1 text-gris hover:text-noir disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => move(item, 1)}
                          disabled={index === questions.length - 1}
                          aria-label={`Descendre « ${item.questionFr} »`}
                          className="px-1 text-gris hover:text-noir disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="min-w-0 flex-1 text-sm font-medium text-noir">
                        {item.questionFr}
                        {!item.questionEn.trim() && <span className="ml-2 text-xs font-normal text-gris">· sans traduction</span>}
                      </span>
                      <span
                        className={
                          item.publicationStatus === "PUBLISHED"
                            ? "rounded-full bg-malachite/15 px-2 py-0.5 text-xs font-medium text-malachite"
                            : "rounded-full bg-gris/15 px-2 py-0.5 text-xs font-medium text-gris"
                        }
                      >
                        {item.publicationStatus === "PUBLISHED" ? "Publiée" : "Brouillon"}
                      </span>
                      <button
                        onClick={() => {
                          setSaveState(null);
                          setEditing({ ...item });
                        }}
                        className="text-sm text-bleu hover:underline"
                      >
                        Modifier
                      </button>
                      <button onClick={() => setDeleteTarget(item)} className="text-sm text-terre-cuite hover:underline">
                        Supprimer
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer cette question ?"
        message={`« ${deleteTarget?.questionFr} » ira à la corbeille. Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
