"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import { formatBadgeNumber } from "@/lib/arrivals-live";
import { useListParams } from "@/lib/use-list-params";
import ListPagination from "@/components/admin/ListPagination";
import StatusBadge from "@/components/admin/StatusBadge";

type BadgeState = "PRINTED" | "TO_FETCH" | "READY" | "DELIVERED";
type BilletwebCheckIn = "none" | "confirmed" | "pending" | "error" | "external" | "undo_pending";
type Variant = "green" | "orange" | "gray" | "blue" | "red";

export interface AttendeeRow {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
  isOutsideFlow: boolean;
  badgeNumber: number | null;
  badgeState: BadgeState;
  labelDelivered: boolean;
  isCancelled: boolean;
  isWithdrawn: boolean;
  scannedAt: string | null;
  scannedBy: string | null;
  scannedOffline: boolean;
  billetweb: BilletwebCheckIn;
  checkInError: string | null;
}

interface AttendeePage {
  page: number;
  limit: number;
  total: number;
  items: AttendeeRow[];
}

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;
const LIST_KEYS = ["search", "filter"] as const;

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tous les participants" },
  { value: "not_scanned", label: "Pas encore arrivés" },
  { value: "waiting", label: "Scannés, badge pas encore remis" },
  { value: "delivered", label: "Badge remis" },
  { value: "checkin_issue", label: "Compostage Billetweb en attente ou en échec" },
  { value: "cancelled", label: "Annulés ou remboursés" },
];

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

const BILLETWEB: Record<BilletwebCheckIn, { label: string; variant: Variant }> = {
  none: { label: "—", variant: "gray" },
  confirmed: { label: "Composté", variant: "green" },
  pending: { label: "En attente d'envoi", variant: "orange" },
  error: { label: "Échec, nouvel essai chaque minute", variant: "red" },
  external: { label: "Composté par Billetweb Scan", variant: "blue" },
  undo_pending: { label: "Décompostage en attente", variant: "orange" },
};

/** Where the badge is, as the stations would say it. */
export function badgeStatus(row: AttendeeRow): { label: string; variant: Variant } {
  if (row.isCancelled) {
    if (row.badgeNumber === null) return { label: "Billet annulé", variant: "gray" };
    return row.isWithdrawn
      ? { label: "Remboursé, badge retiré", variant: "gray" }
      : { label: "Remboursé, badge à retirer", variant: "red" };
  }
  if (row.badgeState === "DELIVERED") {
    return { label: row.labelDelivered ? "Étiquette remise" : "Distribué", variant: "green" };
  }
  if (!row.scannedAt) return { label: "Pas arrivé", variant: "gray" };
  if (row.isOutsideFlow) return { label: "Accueil dédié", variant: "blue" };
  if (row.badgeNumber === null) return { label: "Sans badge : Cas particuliers", variant: "orange" };
  if (row.badgeState === "READY") return { label: "Prêt", variant: "blue" };
  if (row.badgeState === "TO_FETCH") return { label: "À chercher", variant: "orange" };
  // Checked in by Billetweb's own app: the import leaves the badge where it is,
  // off the counter's screen (#800).
  return { label: "Scanné, pas au guichet", variant: "gray" };
}

function formatScan(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Every attendee and where their arrival stands (#806), to answer "has X
// arrived?" and spot what is stuck. Read-only: badges move on the stations.
export default function AttendeesSection({ editionId }: { editionId: number }) {
  const { params, page, update } = useListParams(LIST_KEYS);
  const [list, setList] = useState<AttendeePage | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchInput, setSearchInput] = useState(params.search);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (params.search) query.set("search", params.search);
  if (params.filter) query.set("filter", params.filter);
  const queryString = query.toString();

  const load = useCallback(async () => {
    const { data, status } = await adminFetch<AttendeePage>(`/attendees/list/${editionId}?${queryString}`);
    setLoadFailed(status !== 200);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [editionId, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  return (
    <section className="mt-8 pt-6 border-t border-gris/20" aria-labelledby="attendees-title">
      <h2 id="attendees-title" className="text-lg font-bold text-noir">
        Participants
      </h2>
      <p className="mb-4 text-sm text-gris">
        Où en est chaque arrivée, ici et sur Billetweb. Lecture seule : les badges se déplacent depuis les postes.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher un participant"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Nom, entreprise ou numéro de badge…"
          className="w-72 max-w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select
          aria-label="Filtrer"
          value={params.filter}
          onChange={(e) => update({ filter: e.target.value })}
          className={SELECT_CLASS}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {list && (
          <span className="text-sm text-gris" aria-live="polite">
            {list.total} participant{list.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loadFailed && (
        <p role="alert" className="mb-4 rounded-xl bg-terre-cuite/10 p-4 text-sm text-terre-cuite">
          La liste n&apos;a pas pu être chargée. Rechargez la page.
        </p>
      )}

      {!list ? (
        <p className="text-sm text-gris">Chargement…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse/60 border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Participant</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Tarif</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Badge</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Arrivée</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Billetweb</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((row) => {
                  const status = badgeStatus(row);
                  const billetweb = BILLETWEB[row.billetweb];
                  return (
                    <tr key={row.id} className="border-b border-gris/10 align-top">
                      <td className="px-4 py-3">
                        <span className="block font-medium text-noir">
                          {row.firstName} {row.lastName}
                        </span>
                        {row.company && <span className="block text-xs text-gris">{row.company}</span>}
                      </td>
                      <td className="px-4 py-3 text-gris">{row.tierName ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="block font-mono tabular-nums text-noir">
                          {row.badgeNumber !== null ? formatBadgeNumber(row.badgeNumber) : "—"}
                        </span>
                        <StatusBadge status={status.label} variant={status.variant} />
                      </td>
                      <td className="px-4 py-3 text-gris">
                        {row.scannedAt ? (
                          <>
                            <span className="block text-noir">{formatScan(row.scannedAt)}</span>
                            <span className="block text-xs">
                              {row.scannedBy ?? "—"}
                              {row.scannedOffline && " · pendant une coupure"}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={billetweb.label} variant={billetweb.variant} />
                        {row.checkInError && <span className="mt-1 block text-xs text-gris">{row.checkInError}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gris">Aucun participant ne correspond.</p>
            )}
          </div>
          <ListPagination
            page={list.page}
            limit={list.limit}
            total={list.total}
            onPageChange={(next) => update({ page: String(next) })}
          />
        </>
      )}
    </section>
  );
}
