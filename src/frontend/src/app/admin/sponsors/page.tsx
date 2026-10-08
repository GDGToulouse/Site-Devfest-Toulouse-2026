"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, AdminSponsorTier } from "@/lib/types";
import { useListParams } from "@/lib/use-list-params";
import DataTable, { type SortState } from "@/components/admin/DataTable";
import ListPagination from "@/components/admin/ListPagination";
import BulkActionBar from "@/components/admin/BulkActionBar";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// One company per row, read on the participation of the year looked at — or
// the latest one without a year (#129). The API works out what the follow-up
// filters ask about (#574): the kit, the logo of the year, access to the
// partner space, the job offers.
interface SponsorRow extends Sponsor {
  edition?: { id: number; year: number };
  tierRank: number | null;
  status: "PUBLISHED" | "DRAFT" | null;
  year: number | null;
  comKitReceived: boolean;
  hasLogo: boolean;
  contactState: "none" | "pending" | "active";
  jobOfferCount: number;
  hasDescription: boolean;
  hasWebsite: boolean;
}

interface SponsorPage {
  page: number;
  limit: number;
  total: number;
  items: SponsorRow[];
}

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;

const LIST_KEYS = ["year", "search", "tier", "status", "comKit", "logo", "contacts", "jobOffers", "missing", "sort", "order"] as const;

const CONTACT_LABELS: Record<SponsorRow["contactState"], string> = {
  none: "Aucun contact",
  pending: "Invitation en attente",
  active: "Compte actif",
};

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50";

export default function SponsorsDataPage() {
  const router = useRouter();
  const { params, page, update } = useListParams(LIST_KEYS);
  const [editions, setEditions] = useState<{ id: number; year: number }[] | null>(null);
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [list, setList] = useState<SponsorPage | null>(null);
  const [searchInput, setSearchInput] = useState(params.search);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SponsorRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      setEditions([...(data ?? [])].sort((a, b) => b.year - a.year));
    });
    // The offer filter lists the catalogue (#321) instead of a frozen enum.
    adminFetch<AdminSponsorTier[]>("/sponsor-tiers").then(({ data }) => setTiers(data ?? []));
  }, []);

  const editionId = editions?.find((e) => String(e.year) === params.year)?.id ?? null;
  const hasEdition = editionId !== null;

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (editionId) query.set("editionId", String(editionId));
  if (params.search) query.set("search", params.search);
  if (params.tier) query.set("tierKey", params.tier);
  if (params.status) query.set("status", params.status);
  // The follow-up is a year's: the API refuses it without an edition.
  if (hasEdition && params.comKit) query.set("comKit", params.comKit);
  if (hasEdition && params.logo) query.set("logo", params.logo);
  if (hasEdition && params.jobOffers) query.set("jobOffers", params.jobOffers);
  if (params.contacts) query.set("contacts", params.contacts);
  if (params.missing) query.set("missing", params.missing);
  if (params.sort) {
    query.set("sort", params.sort);
    query.set("order", params.order || "asc");
  }
  const queryString = query.toString();

  const load = useCallback(async () => {
    const { data } = await adminFetch<SponsorPage>(`/sponsors?${queryString}`);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [queryString]);

  useEffect(() => {
    // Wait for the editions: the year in the URL means nothing until it maps to an id.
    if (editions === null) return;
    load();
  }, [editions, load]);

  // Another page, filter or order shows other rows: a selection carried over
  // would act on companies no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryString]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function applyBulk(value: "DRAFT" | "PUBLISHED") {
    // publicationStatus lives on the participation (#129), so an edition has to
    // be picked: applying to every edition a sponsor appears in would publish
    // it on a year the admin was not even looking at (the guard #351
    // established for speakers).
    if (!editionId) {
      setError("Choisissez une édition avant d'appliquer une action groupée.");
      return;
    }
    setError(null);
    const { status, error: apiError } = await adminFetch("/sponsors/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: [...selectedIds], action: "setStatus", value, editionId }),
    });
    if (status !== 200) {
      setError(apiError ?? "Action groupée impossible.");
      return;
    }
    setSelectedIds(new Set());
    await load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    // Soft-delete since #147: 204, the sponsor moves to the trash. Its contacts
    // and job offers go with it on the public side; the row itself is restorable.
    const { status, error: apiError } = await adminFetch(`/sponsors/${deleteTarget.id}`, {
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
      key: "name",
      label: "Sponsor",
      sortable: true,
      render: (s: SponsorRow) => {
        const gaps = [!s.hasLogo && "logo", !s.hasDescription && "description", !s.hasWebsite && "site web"].filter(Boolean);
        return (
          <>
            <span className="font-medium text-noir">{s.name}</span>
            {gaps.length > 0 && <span className="block text-xs text-gris">Sans {gaps.join(", ")}</span>}
          </>
        );
      },
    },
    // Sorted in the public page's order, most important tier first (#498).
    { key: "tier", label: "Niveau", sortable: true, render: (s: SponsorRow) => s.tier?.nameFr ?? "—" },
    {
      key: "status",
      label: "Statut",
      sortable: true,
      render: (s: SponsorRow) =>
        // A company with no participation has no status at all (#498).
        s.status ? (
          <StatusBadge status={s.status === "PUBLISHED" ? "Publié" : "Brouillon"} variant={s.status === "PUBLISHED" ? "green" : "gray"} />
        ) : (
          "—"
        ),
    },
    // The year's follow-up, once a year is chosen: across editions it would mix them.
    ...(hasEdition
      ? [
          { key: "comKit", label: "Kit de com", render: (s: SponsorRow) => (s.comKitReceived ? "Reçu" : "—") },
          { key: "jobOffers", label: "Offres", render: (s: SponsorRow) => s.jobOfferCount || "—" },
        ]
      : []),
    { key: "contacts", label: "Accès", render: (s: SponsorRow) => CONTACT_LABELS[s.contactState] },
    { key: "edition", label: "Édition", sortable: true, render: (s: SponsorRow) => s.year ?? "—" },
  ];

  const hasFilters = LIST_KEYS.some((key) => key !== "sort" && key !== "order" && params[key]);
  const yearOnly = { disabled: !hasEdition, title: hasEdition ? undefined : "Choisissez une édition" };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Sponsors</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/sponsors/new")}
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
          placeholder="Rechercher un sponsor…"
          className="w-64 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select aria-label="Édition" value={params.year} onChange={(e) => update({ year: e.target.value })} className={SELECT_CLASS}>
          <option value="">Toutes les éditions</option>
          {(editions ?? []).map((e) => (
            <option key={e.id} value={e.year}>{e.year}</option>
          ))}
        </select>
        <select aria-label="Niveau" value={params.tier} onChange={(e) => update({ tier: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les niveaux</option>
          {tiers.map((tier) => (
            <option key={tier.key} value={tier.key}>{tier.nameFr}</option>
          ))}
        </select>
        <select aria-label="Statut" value={params.status} onChange={(e) => update({ status: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publié</option>
          <option value="DRAFT">Brouillon</option>
        </select>
        <select aria-label="Kit de communication" value={hasEdition ? params.comKit : ""} onChange={(e) => update({ comKit: e.target.value })} {...yearOnly} className={SELECT_CLASS}>
          <option value="">Kit : tous</option>
          <option value="received">Kit reçu</option>
          <option value="missing">Kit non reçu</option>
        </select>
        <select aria-label="Logo de l'année" value={hasEdition ? params.logo : ""} onChange={(e) => update({ logo: e.target.value })} {...yearOnly} className={SELECT_CLASS}>
          <option value="">Logo : tous</option>
          <option value="missing">Logo manquant</option>
        </select>
        <select aria-label="Accès à l'espace partenaire" value={params.contacts} onChange={(e) => update({ contacts: e.target.value })} className={SELECT_CLASS}>
          <option value="">Accès : tous</option>
          <option value="none">Aucun contact</option>
          <option value="pending">Invitation en attente</option>
          <option value="active">Compte actif</option>
        </select>
        <select aria-label="Offres d'emploi" value={hasEdition ? params.jobOffers : ""} onChange={(e) => update({ jobOffers: e.target.value })} {...yearOnly} className={SELECT_CLASS}>
          <option value="">Offres : toutes</option>
          <option value="with">Avec offre</option>
          <option value="without">Sans offre</option>
        </select>
        <select aria-label="Fiche incomplète" value={params.missing} onChange={(e) => update({ missing: e.target.value })} className={SELECT_CLASS}>
          <option value="">Fiche : toutes</option>
          <option value="description">Sans description</option>
          <option value="website">Sans site web</option>
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
            {list.total} sponsor{list.total > 1 ? "s" : ""}
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
          entitySingular="sponsor"
          entityPlural="sponsors"
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
          <DataTable<SponsorRow>
            columns={columns}
            data={list.items}
            emptyMessage={hasFilters ? "Aucun sponsor ne correspond à ces filtres" : "Aucun sponsor"}
            onEdit={(s) => router.push(`/admin/sponsors/${s.id}`)}
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
        title="Supprimer le sponsor"
        message={`Supprimer « ${deleteTarget?.name} » ? Il disparaîtra des pages publiques. Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
