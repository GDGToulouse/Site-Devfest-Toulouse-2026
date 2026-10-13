"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import { useListParams } from "@/lib/use-list-params";
import DataTable, { type SortState } from "@/components/admin/DataTable";
import ListPagination from "@/components/admin/ListPagination";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// Every sponsor's job offers in one list (#609), to review them before relaying
// them. Editing happens on the sponsor's sheet, where the quota and the year
// are in view: a row leads there rather than to a second form.
interface JobOfferRow {
  id: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  sponsor: { id: number; name: string };
  editionId: number;
  year: number;
  tierName: string;
}

interface JobOfferPage {
  page: number;
  limit: number;
  total: number;
  items: JobOfferRow[];
}

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;

const LIST_KEYS = ["year", "sponsor", "search", "sort", "order"] as const;

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

export default function JobOffersPage() {
  const router = useRouter();
  const { params, page, update } = useListParams(LIST_KEYS);
  const [editions, setEditions] = useState<{ id: number; year: number }[] | null>(null);
  const [sponsors, setSponsors] = useState<{ id: number; name: string }[]>([]);
  const [list, setList] = useState<JobOfferPage | null>(null);
  const [searchInput, setSearchInput] = useState(params.search);
  const [deleteTarget, setDeleteTarget] = useState<JobOfferRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      setEditions([...(data ?? [])].sort((a, b) => b.year - a.year));
    });
  }, []);

  const editionId = editions?.find((e) => String(e.year) === params.year)?.id ?? null;

  // The sponsor filter offers the companies of the chosen year, or all of them.
  useEffect(() => {
    if (editions === null) return;
    adminFetch<{ id: number; name: string }[]>(editionId ? `/sponsors?editionId=${editionId}` : "/sponsors").then(({ data }) =>
      setSponsors(data ?? []),
    );
  }, [editions, editionId]);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (editionId) query.set("editionId", String(editionId));
  if (params.sponsor) query.set("sponsorId", params.sponsor);
  if (params.search) query.set("search", params.search);
  if (params.sort) {
    query.set("sort", params.sort);
    query.set("order", params.order || "asc");
  }
  const queryString = query.toString();

  const load = useCallback(async () => {
    const { data } = await adminFetch<JobOfferPage>(`/job-offers?${queryString}`);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [queryString]);

  useEffect(() => {
    // Wait for the editions: the year in the URL means nothing until it maps to an id.
    if (editions === null) return;
    load();
  }, [editions, load]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    const { status } = await adminFetch(`/job-offers/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (status !== 204) {
      setError("La suppression a échoué. Réessayez.");
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
      label: "Offre",
      sortable: true,
      render: (o: JobOfferRow) => (
        <>
          <span className="font-medium text-noir">{o.title}</span>
          <a
            href={o.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block max-w-xs truncate text-xs text-bleu hover:underline"
          >
            {o.url}
          </a>
        </>
      ),
    },
    { key: "sponsor", label: "Sponsor", sortable: true, render: (o: JobOfferRow) => o.sponsor.name },
    { key: "tier", label: "Niveau", render: (o: JobOfferRow) => o.tierName },
    { key: "edition", label: "Édition", render: (o: JobOfferRow) => o.year },
    { key: "createdAt", label: "Créée le", sortable: true, render: (o: JobOfferRow) => dateFormat.format(new Date(o.createdAt)) },
    { key: "updatedAt", label: "Modifiée le", sortable: true, render: (o: JobOfferRow) => dateFormat.format(new Date(o.updatedAt)) },
  ];

  const hasFilters = LIST_KEYS.some((key) => key !== "sort" && key !== "order" && params[key]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-noir">Offres d&apos;emploi</h1>
        <p className="mt-1 text-sm text-gris">
          Les offres publiées par les sponsors. Pour en ajouter une, ouvrez la fiche du sponsor.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher une offre ou un sponsor…"
          className="w-72 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select aria-label="Édition" value={params.year} onChange={(e) => update({ year: e.target.value, sponsor: "" })} className={SELECT_CLASS}>
          <option value="">Toutes les éditions</option>
          {(editions ?? []).map((e) => (
            <option key={e.id} value={e.year}>{e.year}</option>
          ))}
        </select>
        <select aria-label="Sponsor" value={params.sponsor} onChange={(e) => update({ sponsor: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les sponsors</option>
          {sponsors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
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
            {list.total} offre{list.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {list === null ? (
        <p className="text-gris">Chargement...</p>
      ) : (
        <>
          <DataTable<JobOfferRow>
            columns={columns}
            data={list.items}
            emptyMessage={hasFilters ? "Aucune offre ne correspond à ces filtres" : "Aucune offre d'emploi"}
            onEdit={(o) =>
              router.push(`/admin/sponsors/${o.sponsor.id}?tab=offres&editionId=${o.editionId}&offer=${o.id}`)
            }
            onDelete={(o) => setDeleteTarget(o)}
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
        title="Supprimer l'offre"
        message={`Supprimer « ${deleteTarget?.title} » (${deleteTarget?.sponsor.name}) ? Elle disparaîtra des pages publiques. Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
