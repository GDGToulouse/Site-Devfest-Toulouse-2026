"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { adminFetch } from "@/lib/admin-api";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// The order of the public menu (#606). The site's entries are always there
// (each shows once its content is live, src/lib/nav.ts) and can only be moved;
// the pages placed in the menu from the Pages screen can also be taken out of
// it, which only sends them back to "nowhere", never deletes them.

interface Slot {
  key: string;
  label: string;
  // Present for a page placed in the menu.
  pageId?: number;
  hint?: string;
}

interface PageSummary {
  id: number;
  slug: string;
  titleFr: string;
  isPublished: boolean;
  navLocation: "NONE" | "HEADER" | "FOOTER";
  navOrder: number;
}

// In the code's default order, which an empty setting keeps.
const SITE_SLOTS: Slot[] = [
  { key: "programme", label: "Programme", hint: "Ou « Conférences », ou « Replays », selon l'avancement de l'édition" },
  { key: "speakers", label: "Speakers", hint: "Dès que des speakers sont publiés" },
  { key: "sponsors", label: "Sponsors", hint: "Dès que des sponsors sont publiés" },
  { key: "venue", label: "Lieu", hint: "Dès que l'édition a un lieu renseigné" },
  { key: "faq", label: "FAQ", hint: "Dès qu'une question est publiée" },
  { key: "blog", label: "Actualités" },
];

function orderSlots(order: string[], pages: PageSummary[]): Slot[] {
  const pageSlots: Slot[] = pages
    .filter((p) => p.navLocation === "HEADER")
    .sort((a, b) => a.navOrder - b.navOrder || a.slug.localeCompare(b.slug))
    .map((p) => ({
      key: `page-${p.slug}`,
      label: p.titleFr,
      pageId: p.id,
      hint: p.isPublished ? `Page /${p.slug}` : `Page /${p.slug} — brouillon, invisible tant qu'elle n'est pas publiée`,
    }));
  const all = [...SITE_SLOTS, ...pageSlots];
  const rank = new Map(order.map((key, i) => [key, i]));
  // Same rule as the site: what the order does not name keeps its default
  // place, after what it names.
  return all
    .map((slot, i) => ({ slot, at: rank.get(slot.key) ?? order.length + i }))
    .sort((a, b) => a.at - b.at)
    .map(({ slot }) => slot);
}

const announcementsFor = (slots: Slot[]): Announcements => {
  const label = (id: string | number) => slots.find((s) => s.key === id)?.label ?? String(id);
  const position = (id: string | number) => slots.findIndex((s) => s.key === id) + 1;
  return {
    onDragStart: ({ active }) => `${label(active.id)} saisi.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} au-dessus de la position ${position(over.id)} sur ${slots.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${label(active.id)} déposé en position ${position(over.id)} sur ${slots.length}.` : `${label(active.id)} déposé.`,
    onDragCancel: ({ active }) => `Déplacement annulé : ${label(active.id)} revient à sa place.`,
  };
};

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Pour déplacer une entrée, appuyez sur Espace ou Entrée sur sa poignée, utilisez les flèches haut et bas, puis Espace ou Entrée pour la déposer, ou Échap pour annuler.",
};

function SortableSlot({ slot, onRemove }: { slot: Slot; onRemove: (slot: Slot) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border bg-blanc px-3 py-2 ${isDragging ? "border-malachite shadow-card" : "border-gris/20"}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Déplacer ${slot.label}`}
        className="cursor-grab touch-none rounded p-1 text-gris hover:bg-blanc-casse hover:text-noir focus-visible:outline-2 focus-visible:outline-malachite"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-noir">
          {slot.label}
          {!slot.pageId && (
            <span className="ml-2 text-xs font-normal text-gris" title="Entrée du site : elle se déplace mais ne se retire pas">
              <span aria-hidden="true">🔒</span> entrée du site
            </span>
          )}
        </p>
        {slot.hint && <p className="text-xs text-gris">{slot.hint}</p>}
      </div>
      {slot.pageId && (
        <button type="button" onClick={() => onRemove(slot)} className="text-sm text-terre-cuite hover:underline">
          Retirer du menu<span className="sr-only"> : {slot.label}</span>
        </button>
      )}
    </li>
  );
}

export default function MenuAdminPage() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [removeTarget, setRemoveTarget] = useState<Slot | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const [menu, pages] = await Promise.all([
      adminFetch<{ order: string[] }>("/settings/menu"),
      adminFetch<PageSummary[]>("/pages"),
    ]);
    setSlots(orderSlots(menu.data?.order ?? [], pages.data ?? []));
    setIsDirty(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!slots || !over || active.id === over.id) return;
    const from = slots.findIndex((s) => s.key === active.id);
    const to = slots.findIndex((s) => s.key === over.id);
    setSlots(arrayMove(slots, from, to));
    setIsDirty(true);
    setSaveState(null);
  }

  async function save() {
    if (!slots) return;
    setIsSaving(true);
    const { status } = await adminFetch("/settings/menu", {
      method: "PUT",
      body: JSON.stringify({ order: slots.map((s) => s.key) }),
    });
    setIsSaving(false);
    if (status !== 200) {
      setSaveState({ kind: "error", text: "L'ordre du menu n'a pas pu être enregistré. Réessayez." });
      return;
    }
    setIsDirty(false);
    setSaveState({ kind: "ok", text: "Ordre du menu enregistré. Il est en ligne sur tout le site." });
  }

  async function confirmRemove() {
    const target = removeTarget;
    setRemoveTarget(null);
    if (!target?.pageId) return;
    const { status } = await adminFetch(`/pages/${target.pageId}`, {
      method: "PUT",
      body: JSON.stringify({ navLocation: "NONE" }),
    });
    if (status !== 200) {
      setSaveState({ kind: "error", text: "La page n'a pas pu être retirée du menu. Réessayez." });
      return;
    }
    setSaveState({ kind: "ok", text: `« ${target.label} » n'est plus dans le menu. La page reste en ligne à son adresse.` });
    await load();
  }

  if (!slots) return <p className="text-gris">Chargement…</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-noir">Menu</h1>
        <p className="mt-1 text-sm text-gris">
          L&apos;ordre des entrées du menu principal, repris par la colonne « Navigation » du pied de page. Une entrée
          du site n&apos;apparaît que lorsque son contenu est en ligne. Pour ajouter une page au menu, ouvrez-la dans{" "}
          <Link href="/admin/pages" className="text-bleu hover:underline">
            Pages
          </Link>{" "}
          et choisissez « Menu principal ».
        </p>
      </div>

      <DndContext
        id="admin-menu-order"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements: announcementsFor(slots), screenReaderInstructions }}
      >
        <SortableContext items={slots.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2" aria-label="Entrées du menu, dans l'ordre">
            {slots.map((slot) => (
              <SortableSlot key={slot.key} slot={slot} onRemove={setRemoveTarget} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="mt-6 space-y-3">
        <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || isSaving}
            className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer l'ordre"}
          </button>
          {isDirty && (
            <button type="button" onClick={load} className="text-sm text-gris hover:underline">
              Annuler les changements
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={removeTarget !== null}
        title="Retirer la page du menu"
        message={`« ${removeTarget?.label} » ne sera plus dans le menu, mais restera en ligne à son adresse. Vous pourrez l'y remettre depuis l'écran Pages.`}
        confirmLabel="Retirer du menu"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
