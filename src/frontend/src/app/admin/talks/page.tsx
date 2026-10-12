"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { AdminVenue, Category, Talk, TalkFormat } from "@/lib/types";
import { formatEventTime } from "@/lib/datetime";
import { useListParams } from "@/lib/use-list-params";
import DataTable, { type SortState } from "@/components/admin/DataTable";
import ListPagination from "@/components/admin/ListPagination";
import BulkActionBar from "@/components/admin/BulkActionBar";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface TalkRow extends Talk {
  edition?: { id: number; year: number };
}

interface TalkPage {
  page: number;
  limit: number;
  total: number;
  items: TalkRow[];
}

const FORMAT_LABELS: Record<TalkFormat, string> = {
  CONFERENCE: "Conférence",
  QUICKIE: "Quickie",
  KEYNOTE: "Keynote",
  WORKSHOP: "Workshop",
};

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;

const LIST_KEYS = [
  "year",
  "search",
  "format",
  "status",
  "category",
  "scheduled",
  "room",
  "speakers",
  "video",
  "editable",
  "sort",
  "order",
] as const;

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50";

// The list asks the API for one page, filtered and sorted (#573), like the
// speakers' (#572): which sessions are still drafts, which have no slot or no
// room, which have no speaker, and after the event which wait for their replay.
export default function TalksDataPage() {
  const router = useRouter();
  const { params, page, update } = useListParams(LIST_KEYS);
  const [editions, setEditions] = useState<{ id: number; year: number }[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string }[]>([]);
  const [list, setList] = useState<TalkPage | null>(null);
  const [searchInput, setSearchInput] = useState(params.search);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<TalkRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      setEditions([...(data ?? [])].sort((a, b) => b.year - a.year));
    });
  }, []);

  const editionId = editions?.find((e) => String(e.year) === params.year)?.id ?? null;
  const hasEdition = editionId !== null;

  // Categories and rooms belong to an edition: they are offered once one is chosen.
  useEffect(() => {
    if (!editionId) {
      setCategories([]);
      setRooms([]);
      return;
    }
    adminFetch<Category[]>(`/categories?editionId=${editionId}`).then(({ data }) => setCategories(data ?? []));
    adminFetch<{ venueId: number | null }>(`/editions/${editionId}`).then(({ data }) => {
      if (!data?.venueId) {
        setRooms([]);
        return;
      }
      adminFetch<AdminVenue>(`/venues/${data.venueId}`).then(({ data: venue }) =>
        setRooms(venue?.rooms.map((r) => ({ id: r.id, name: r.name })) ?? []),
      );
    });
  }, [editionId]);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (editionId) query.set("editionId", String(editionId));
  if (params.search) query.set("search", params.search);
  if (params.format) query.set("format", params.format);
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("categoryId", params.category);
  // A slot and a room are an edition's: the API refuses them without one.
  if (hasEdition && params.scheduled) query.set("scheduled", params.scheduled);
  if (hasEdition && params.room) query.set("roomId", params.room);
  if (params.speakers) query.set("speakers", params.speakers);
  if (params.video) query.set("video", params.video);
  if (params.editable) query.set("speakerEditable", params.editable);
  if (params.sort) {
    query.set("sort", params.sort);
    query.set("order", params.order || "asc");
  }
  const queryString = query.toString();

  const load = useCallback(async () => {
    const { data } = await adminFetch<TalkPage>(`/talks?${queryString}`);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [queryString]);

  useEffect(() => {
    // Wait for the editions: the year in the URL means nothing until it maps to an id.
    if (editions === null) return;
    load();
  }, [editions, load]);

  // Another page, filter or order shows other rows: a selection carried over
  // would act on sessions no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryString]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function applyBulk(value: "DRAFT" | "PUBLISHED") {
    const { status } = await adminFetch("/talks/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: [...selectedIds], action: "setStatus", value }),
    });
    if (status !== 200) return;
    setSelectedIds(new Set());
    await load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    // Soft-delete since #147: 204, the talk moves to the trash.
    const { status, error: apiError } = await adminFetch(`/talks/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    if (status !== 204) {
      setError(apiError ?? "Suppression impossible.");
      return;
    }
    // The last row of a page gone: step back rather than show an empty page.
    if (list && list.items.length === 1 && page > 1) update({ page: String(page - 1) });
    else await load();
  }

  const sort: SortState = params.sort
    ? { key: params.sort, direction: params.order === "desc" ? "descending" : "ascending" }
    : null;

  const columns = [
    {
      key: "title",
      label: "Titre",
      sortable: true,
      render: (t: TalkRow) => <span className="font-medium text-noir">{t.title}</span>,
    },
    { key: "format", label: "Format", sortable: true, render: (t: TalkRow) => FORMAT_LABELS[t.format] },
    {
      key: "category",
      label: "Catégorie",
      render: (t: TalkRow) =>
        t.category ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.category.color }} />
            {t.category.nameFr}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "speakers",
      label: "Speakers",
      render: (t: TalkRow) => (t.speakers.length ? t.speakers.map((s) => s.name).join(", ") : "—"),
    },
    // The slot, once an edition is chosen: across editions it reads as noise.
    ...(hasEdition
      ? [
          {
            key: "startsAt",
            label: "Horaire",
            sortable: true,
            render: (t: TalkRow) =>
              t.startsAt ? (
                <span className="tabular-nums">
                  {formatEventTime(t.startsAt)}
                  {t.room?.name && <span className="block text-xs text-gris">{t.room.name}</span>}
                </span>
              ) : (
                <span className="text-gris">Non planifiée</span>
              ),
          },
        ]
      : []),
    {
      key: "status",
      label: "Statut",
      sortable: true,
      render: (t: TalkRow) => (
        <StatusBadge
          status={t.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
          variant={t.publicationStatus === "PUBLISHED" ? "green" : "gray"}
        />
      ),
    },
    { key: "edition", label: "Édition", sortable: true, render: (t: TalkRow) => t.edition?.year ?? "—" },
  ];

  const hasFilters = LIST_KEYS.some((key) => key !== "sort" && key !== "order" && params[key]);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Conférences</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/talks/new")}
          className="shrink-0 px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Ajouter
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un titre, un speaker…"
          className="w-64 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select
          aria-label="Édition"
          value={params.year}
          // Categories and rooms are the edition's: they go with it.
          onChange={(e) => update({ year: e.target.value, category: "", room: "" })}
          className={SELECT_CLASS}
        >
          <option value="">Toutes les éditions</option>
          {(editions ?? []).map((e) => (
            <option key={e.id} value={e.year}>{e.year}</option>
          ))}
        </select>
        <select aria-label="Format" value={params.format} onChange={(e) => update({ format: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les formats</option>
          {(Object.keys(FORMAT_LABELS) as TalkFormat[]).map((f) => (
            <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
          ))}
        </select>
        <select aria-label="Statut" value={params.status} onChange={(e) => update({ status: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publié</option>
          <option value="DRAFT">Brouillon</option>
        </select>
        <select
          aria-label="Catégorie"
          value={params.category}
          onChange={(e) => update({ category: e.target.value })}
          disabled={!hasEdition}
          title={hasEdition ? undefined : "Choisissez une édition"}
          className={SELECT_CLASS}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameFr}</option>
          ))}
        </select>
        <select
          aria-label="Programmation"
          value={hasEdition ? params.scheduled : ""}
          onChange={(e) => update({ scheduled: e.target.value })}
          disabled={!hasEdition}
          title={hasEdition ? undefined : "Choisissez une édition"}
          className={SELECT_CLASS}
        >
          <option value="">Planifiées ou non</option>
          <option value="yes">Planifiées</option>
          <option value="no">Non planifiées</option>
        </select>
        <select
          aria-label="Salle"
          value={hasEdition ? params.room : ""}
          onChange={(e) => update({ room: e.target.value })}
          disabled={!hasEdition}
          title={hasEdition ? undefined : "Choisissez une édition"}
          className={SELECT_CLASS}
        >
          <option value="">Toutes les salles</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select aria-label="Speakers" value={params.speakers} onChange={(e) => update({ speakers: e.target.value })} className={SELECT_CLASS}>
          <option value="">Avec ou sans speaker</option>
          <option value="none">Sans speaker</option>
        </select>
        <select aria-label="Replay" value={params.video} onChange={(e) => update({ video: e.target.value })} className={SELECT_CLASS}>
          <option value="">Replay : tous</option>
          <option value="with">Avec replay</option>
          <option value="without">Sans replay</option>
        </select>
        <select
          aria-label="Modifiable par le speaker"
          value={params.editable}
          onChange={(e) => update({ editable: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Modifiable par le speaker : tous</option>
          <option value="yes">Modifiable par le speaker</option>
          <option value="no">Non modifiable</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              update(Object.fromEntries(LIST_KEYS.map((key) => [key, ""])));
            }}
            className="text-sm text-bleu underline"
          >
            Réinitialiser
          </button>
        )}
        {list && (
          <span className="text-sm text-gris" aria-live="polite">
            {list.total} conférence{list.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          entitySingular="conférence"
          entityPlural="conférences"
          onSetStatus={applyBulk}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {list === null ? (
        <p className="text-gris">Chargement...</p>
      ) : (
        <>
          <DataTable<TalkRow>
            columns={columns}
            data={list.items}
            emptyMessage={hasFilters ? "Aucune conférence ne correspond à ces filtres" : "Aucune conférence"}
            onEdit={(t) => router.push(`/admin/talks/${t.id}`)}
            onDelete={(t) => setDeleteTarget(t)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            sort={sort}
            onSortChange={(next) =>
              update({ sort: next?.key ?? "", order: next?.direction === "descending" ? "desc" : "asc" })
            }
          />
          <ListPagination
            page={list.page}
            limit={list.limit}
            total={list.total}
            onPageChange={(next) => update({ page: String(next) })}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer la conférence"
        message={`Supprimer « ${deleteTarget?.title} » ? Elle disparaîtra des pages publiques. Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
