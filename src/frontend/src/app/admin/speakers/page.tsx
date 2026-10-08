"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker } from "@/lib/types";
import { useListParams } from "@/lib/use-list-params";
import DataTable, { type SortState } from "@/components/admin/DataTable";
import ListPagination from "@/components/admin/ListPagination";
import BulkActionBar from "@/components/admin/BulkActionBar";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// #351: a speaker takes part in several editions, so the row carries them all.
// #572: the API adds what the filters are about — the talk count of the chosen
// edition, the gaps in the profile and where the edit link stands.
type SpeakerRow = Speaker & {
  talkCount: number;
  status: "PUBLISHED" | "DRAFT" | null;
  hasPhoto: boolean;
  hasBio: boolean;
  hasEmail: boolean;
  editLink: "never" | "sent" | "locked" | "revoked";
};

interface SpeakerPage {
  page: number;
  limit: number;
  total: number;
  items: SpeakerRow[];
}

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;

const LIST_KEYS = ["year", "search", "status", "talks", "missing", "editLink", "sort", "order"] as const;

const EDIT_LINK_LABELS: Record<SpeakerRow["editLink"], string> = {
  never: "Jamais envoyé",
  sent: "Envoyé",
  locked: "Verrouillé",
  revoked: "Révoqué",
};

const MISSING_LABELS = { photo: "photo", bio: "bio", email: "e-mail" } as const;

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50";

// The participation the admin is currently looking at. With no year filter a
// person may hold several, in which case the most recent one is shown — the
// API already sorts `editions` newest first.
function currentParticipation(speaker: SpeakerRow, year: string) {
  if (!year) return speaker.editions[0];
  return speaker.editions.find((e) => String(e.year) === year);
}

export default function SpeakersDataPage() {
  const router = useRouter();
  const { params, page, update } = useListParams(LIST_KEYS);
  const [editions, setEditions] = useState<{ id: number; year: number }[] | null>(null);
  const [list, setList] = useState<SpeakerPage | null>(null);
  const [searchInput, setSearchInput] = useState(params.search);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SpeakerRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The year filter lists the editions themselves, not the years found among
  // the speakers loaded: the page now holds fifty of them at most.
  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      setEditions([...(data ?? [])].sort((a, b) => b.year - a.year));
    });
  }, []);

  const editionId = editions?.find((e) => String(e.year) === params.year)?.id ?? null;
  const hasEdition = editionId !== null;

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (editionId) query.set("editionId", String(editionId));
  if (params.search) query.set("search", params.search);
  // Status, talks and the status sort read one participation: the API refuses
  // them without an edition, so they are only sent with one.
  if (hasEdition && params.status) query.set("status", params.status);
  if (hasEdition && params.talks) query.set("talks", params.talks);
  if (params.missing) query.set("missing", params.missing);
  if (params.editLink) query.set("editLink", params.editLink);
  if (params.sort && (hasEdition || params.sort !== "status")) {
    query.set("sort", params.sort);
    query.set("order", params.order || "asc");
  }
  const queryString = query.toString();

  const load = useCallback(async () => {
    const { data } = await adminFetch<SpeakerPage>(`/speakers?${queryString}`);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [queryString]);

  useEffect(() => {
    // Wait for the editions: the year in the URL means nothing until it maps to an id.
    if (editions === null) return;
    load();
  }, [editions, load]);

  // A new page, filter or order shows other rows: a selection carried over
  // would act on speakers no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryString]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function applyBulk(action: "setStatus" | "setFeatured", value: "DRAFT" | "PUBLISHED" | boolean) {
    // Both actions target one participation since #351, so an edition has to be
    // picked: applying to every year a speaker took part in would publish people
    // on editions the admin was not even looking at.
    if (!editionId) {
      setError("Choisissez une édition avant d'appliquer une action groupée.");
      return;
    }
    const { status } = await adminFetch("/speakers/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: [...selectedIds], editionId, action, value }),
    });
    if (status !== 200) return;
    setSelectedIds(new Set());
    await load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    // Soft-delete since #147: the backend answers 204 and the row moves to the
    // trash. adminFetch returns 204 explicitly — test the status, not 200.
    const { status, error: apiError } = await adminFetch(`/speakers/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    if (status !== 204) {
      setError(apiError ?? "Suppression impossible.");
      return;
    }
    // The last row of a page gone: step back rather than show an empty page
    // while others exist (the side effect #416 found on the articles).
    if (list && list.items.length === 1 && page > 1) update({ page: String(page - 1) });
    else await load();
  }

  const sort: SortState = params.sort
    ? { key: params.sort, direction: params.order === "desc" ? "descending" : "ascending" }
    : null;

  const columns = [
    {
      key: "name",
      label: "Speaker",
      sortable: true,
      render: (s: SpeakerRow) => {
        const missing = (["photo", "bio", "email"] as const).filter(
          (field) => !{ photo: s.hasPhoto, bio: s.hasBio, email: s.hasEmail }[field],
        );
        return (
          <>
            <span className="font-medium text-noir">{s.name}</span>
            {missing.length > 0 && (
              <span className="block text-xs text-gris">Sans {missing.map((m) => MISSING_LABELS[m]).join(", ")}</span>
            )}
          </>
        );
      },
    },
    { key: "company", label: "Société", sortable: true, render: (s: SpeakerRow) => s.company ?? "—" },
    {
      key: "status",
      label: "Statut",
      sortable: hasEdition,
      render: (s: SpeakerRow) => {
        const participation = currentParticipation(s, params.year);
        if (!participation) return "—";
        return (
          <StatusBadge
            status={participation.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
            variant={participation.publicationStatus === "PUBLISHED" ? "green" : "gray"}
          />
        );
      },
    },
    { key: "talks", label: "Sessions", sortable: true, render: (s: SpeakerRow) => s.talkCount },
    {
      key: "featured",
      label: "À la une",
      render: (s: SpeakerRow) => (currentParticipation(s, params.year)?.isFeatured ? "★" : ""),
    },
    { key: "editLink", label: "Lien", render: (s: SpeakerRow) => EDIT_LINK_LABELS[s.editLink] },
    {
      key: "editions",
      label: "Éditions",
      // Every year the person took part in, so a multi-edition speaker reads as
      // one row instead of the duplicates the old model produced.
      render: (s: SpeakerRow) => (s.editions.length ? s.editions.map((e) => e.year).join(", ") : "—"),
    },
  ];

  const hasFilters = LIST_KEYS.some((key) => key !== "sort" && key !== "order" && params[key]);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Speakers</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/speakers/new")}
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
          placeholder="Rechercher un nom, une société…"
          className="w-64 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select aria-label="Édition" value={params.year} onChange={(e) => update({ year: e.target.value })} className={SELECT_CLASS}>
          <option value="">Toutes les éditions</option>
          {(editions ?? []).map((e) => (
            <option key={e.id} value={e.year}>{e.year}</option>
          ))}
        </select>
        <select
          aria-label="Statut"
          value={hasEdition ? params.status : ""}
          onChange={(e) => update({ status: e.target.value })}
          disabled={!hasEdition}
          title={hasEdition ? undefined : "Choisissez une édition"}
          className={SELECT_CLASS}
        >
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publié</option>
          <option value="DRAFT">Brouillon</option>
        </select>
        <select
          aria-label="Sessions"
          value={hasEdition ? params.talks : ""}
          onChange={(e) => update({ talks: e.target.value })}
          disabled={!hasEdition}
          title={hasEdition ? undefined : "Choisissez une édition"}
          className={SELECT_CLASS}
        >
          <option value="">Avec ou sans session</option>
          <option value="with">Avec session</option>
          <option value="without">Sans session</option>
        </select>
        <select aria-label="Fiche incomplète" value={params.missing} onChange={(e) => update({ missing: e.target.value })} className={SELECT_CLASS}>
          <option value="">Fiche : toutes</option>
          <option value="photo">Sans photo</option>
          <option value="bio">Sans bio</option>
          <option value="email">Sans e-mail</option>
        </select>
        <select aria-label="Lien de modification" value={params.editLink} onChange={(e) => update({ editLink: e.target.value })} className={SELECT_CLASS}>
          <option value="">Lien : tous</option>
          <option value="never">Jamais envoyé</option>
          <option value="sent">Envoyé</option>
          <option value="locked">Verrouillé</option>
          <option value="revoked">Révoqué</option>
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
            {list.total} speaker{list.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {selectedIds.size > 0 && !editionId && (
        <div role="status" className="mb-4 rounded-lg bg-jaune/10 px-4 py-3 text-sm text-noir">
          Les actions groupées s&apos;appliquent à une édition : choisissez une année dans le
          filtre ci-dessus.
        </div>
      )}

      {selectedIds.size > 0 && editionId && (
        <BulkActionBar
          count={selectedIds.size}
          entitySingular="speaker"
          entityPlural="speakers"
          onSetStatus={(value) => applyBulk("setStatus", value)}
          onSetFeatured={(value) => applyBulk("setFeatured", value)}
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
          <DataTable<SpeakerRow>
            columns={columns}
            data={list.items}
            emptyMessage={hasFilters ? "Aucun speaker ne correspond à ces filtres" : "Aucun speaker"}
            onEdit={(s) => router.push(`/admin/speakers/${s.id}`)}
            onDelete={(s) => setDeleteTarget(s)}
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
        title="Supprimer le speaker"
        message={`Supprimer « ${deleteTarget?.name} » ? Il disparaîtra des pages publiques. Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
