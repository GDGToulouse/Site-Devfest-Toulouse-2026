"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, getAdminSession, purgeExpiredTrash } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

// The twelve soft-deletable entities, in the order the trash shows them. Kept in
// sync with the backend registry (trash-registry.ts); `adminOnly` mirrors the
// API, which 403s an EDITOR on those — the page hides them rather than letting
// the call fail.
const TRASH_ENTITIES: { key: string; label: string; adminOnly: boolean }[] = [
  { key: "articles", label: "Articles", adminOnly: false },
  { key: "tags", label: "Tags", adminOnly: false },
  { key: "speakers", label: "Speakers", adminOnly: false },
  { key: "talks", label: "Conférences", adminOnly: false },
  { key: "sponsors", label: "Sponsors", adminOnly: false },
  { key: "categories", label: "Catégories", adminOnly: false },
  { key: "contact-categories", label: "Catégories de contact", adminOnly: false },
  { key: "contact-messages", label: "Messages", adminOnly: false },
  { key: "ticket-tiers", label: "Tarifs billetterie", adminOnly: true },
  { key: "sponsor-tiers", label: "Niveaux sponsors", adminOnly: true },
  { key: "editions", label: "Éditions", adminOnly: true },
  { key: "users", label: "Utilisateurs", adminOnly: true },
];

interface TrashItem {
  id: number | string;
  label: string;
  deletedAt: string;
}

interface TrashListResponse {
  entity: string;
  retentionDays: number;
  items: TrashItem[];
}

interface TrashSummary {
  entities: { entity: string; count: number }[];
  total: number;
}

/** Days left before auto-purge, from the deletion date and the retention window. */
function daysLeft(deletedAt: string, retentionDays: number): number {
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, retentionDays - elapsedDays);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TrashPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState("articles");
  const [items, setItems] = useState<TrashItem[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore / purge targets drive the two dialogs. Purge is danger-styled.
  const [restoreTarget, setRestoreTarget] = useState<TrashItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Manual purge of everything past the retention window (#335): the scheduled
  // task is not enabled, so the trash would otherwise never empty on its own.
  const [isPurgeAllOpen, setIsPurgeAllOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeReport, setPurgeReport] = useState<string | null>(null);

  useEffect(() => {
    // Mirror AdminShell's convention: fetch the role, gate the admin-only tabs.
    getAdminSession().then((session) => {
      setIsAdmin(session?.role === "ADMIN");
      setRoleLoaded(true);
    });
  }, []);

  const loadCounts = useCallback(async () => {
    const { data } = await adminFetch<TrashSummary>("/trash");
    if (data) {
      const map: Record<string, number> = {};
      for (const e of data.entities) map[e.entity] = e.count;
      setCounts(map);
    }
  }, []);

  const loadItems = useCallback(async (entity: string) => {
    setIsLoading(true);
    setError(null);
    const { data, status, error: fetchError } = await adminFetch<TrashListResponse>(`/trash/${entity}`);
    if (data) {
      setItems(data.items);
      setRetentionDays(data.retentionDays);
    } else {
      setItems([]);
      setError(status === 403 ? "Accès réservé aux administrateurs." : fetchError ?? "Chargement impossible.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadItems(selectedEntity);
  }, [selectedEntity, loadItems]);

  async function handleRestore() {
    if (!restoreTarget) return;
    setActionError(null);
    const { status, error: restoreError } = await adminFetch(
      `/trash/${selectedEntity}/${restoreTarget.id}/restore`,
      { method: "POST" },
    );
    setRestoreTarget(null);

    if (status === 409) {
      // The slug was taken while the row waited in the trash (#148). Name it so
      // the organizer knows to rename the live one first.
      setActionError(restoreError ?? "Restauration impossible : un élément actif occupe déjà cette valeur.");
      return;
    }
    if (status !== 200) {
      setActionError(restoreError ?? "Restauration impossible.");
      return;
    }
    await Promise.all([loadItems(selectedEntity), loadCounts()]);
  }

  async function handlePurge() {
    if (!purgeTarget) return;
    setActionError(null);
    const { status, error: purgeError } = await adminFetch(
      `/trash/${selectedEntity}/${purgeTarget.id}/purge`,
      { method: "DELETE" },
    );
    setPurgeTarget(null);

    if (status !== 200) {
      setActionError(
        status === 403
          ? "La suppression définitive est réservée aux administrateurs."
          : purgeError ?? "Suppression impossible.",
      );
      return;
    }
    await Promise.all([loadItems(selectedEntity), loadCounts()]);
  }

  async function handlePurgeAll() {
    setIsPurgeAllOpen(false);
    setActionError(null);
    setPurgeReport(null);
    setIsPurging(true);

    const { data, status, error: purgeError } = await purgeExpiredTrash();
    setIsPurging(false);

    if (!data) {
      setActionError(
        status === 401 || status === 403
          ? "La purge est réservée aux administrateurs. Votre session a peut-être expiré."
          : purgeError ?? "Purge impossible.",
      );
      return;
    }

    // Zero is a normal outcome, not a failure: the endpoint is idempotent and
    // only destroys what is past the retention window.
    setPurgeReport(
      data.totalPurged === 0
        ? "Aucun élément n'avait dépassé le délai de conservation : rien n'a été supprimé."
        : `${data.totalPurged} élément${data.totalPurged > 1 ? "s" : ""} supprimé${data.totalPurged > 1 ? "s" : ""} définitivement.`,
    );
    await Promise.all([loadItems(selectedEntity), loadCounts()]);
  }

  const visibleEntities = TRASH_ENTITIES.filter((e) => isAdmin || !e.adminOnly);

  // Wait for the role before rendering tabs, or an EDITOR briefly sees the
  // admin-only ones flash in.
  if (!roleLoaded) {
    return <p className="text-gris">Chargement…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Corbeille</h1>
          <p className="mt-1 text-sm text-gris">
            Les éléments supprimés sont conservés {retentionDays} jours, puis
            définitivement effacés. Vous pouvez les restaurer ou les supprimer
            immédiatement.
          </p>
        </div>
        {/* Global action: purges every entity at once, so it belongs to the page
            header rather than to the selected entity tab (#335). */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsPurgeAllOpen(true)}
            disabled={isPurging}
            className="shrink-0 rounded-lg border border-terre-cuite px-4 py-2 text-sm font-medium text-terre-cuite transition-colors hover:bg-terre-cuite hover:text-blanc disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPurging ? "Purge en cours…" : "Purger les éléments expirés"}
          </button>
        )}
      </div>

      {/* Entity tabs, with a count badge each. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {visibleEntities.map((entity) => {
          const count = counts[entity.key] ?? 0;
          const isActive = entity.key === selectedEntity;
          return (
            <button
              key={entity.key}
              type="button"
              onClick={() => setSelectedEntity(entity.key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? "bg-bismarck text-blanc" : "bg-blanc text-noir shadow-card hover:bg-blanc-casse"
              }`}
            >
              {entity.label}
              {count > 0 && (
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                    isActive ? "bg-blanc text-bismarck" : "bg-terre-cuite text-blanc"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite"
        >
          {actionError}
        </div>
      )}

      {purgeReport && (
        <div
          role="status"
          className="mb-4 rounded-lg bg-malachite/10 px-4 py-3 text-sm text-malachite"
        >
          {purgeReport}
        </div>
      )}

      <div className="rounded-2xl bg-blanc p-5 shadow-card">
        {isLoading ? (
          <p className="text-gris">Chargement…</p>
        ) : error ? (
          <p className="py-8 text-center text-gris">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-gris">La corbeille est vide pour ce type.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-blanc-casse text-gris">
                <th className="py-2 pr-4 font-medium">Élément</th>
                <th className="py-2 pr-4 font-medium">Supprimé le</th>
                <th className="py-2 pr-4 font-medium">Purge auto</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const left = daysLeft(item.deletedAt, retentionDays);
                return (
                  <tr key={String(item.id)} className="border-b border-blanc-casse last:border-0">
                    <td className="py-3 pr-4 font-medium text-noir">{item.label || "—"}</td>
                    <td className="py-3 pr-4 text-gris">{formatDate(item.deletedAt)}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        variant={left <= 3 ? "orange" : "blue"}
                        status={left === 0 ? "imminente" : `dans ${left} j`}
                      />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(item)}
                        className="mr-2 font-medium text-bleu hover:underline"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurgeTarget(item)}
                        className="font-medium text-terre-cuite hover:underline"
                      >
                        Supprimer définitivement
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!restoreTarget}
        title="Restaurer l'élément"
        message={`Restaurer « ${restoreTarget?.label} » ? Il réapparaîtra dans les listes.`}
        confirmLabel="Restaurer"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        isOpen={isPurgeAllOpen}
        title="Purger les éléments expirés"
        message={`Supprimer définitivement tous les éléments en corbeille depuis plus de ${retentionDays} jours, quel que soit leur type ? Les éléments plus récents sont conservés. Cette action est irréversible.`}
        confirmLabel="Purger"
        variant="danger"
        onConfirm={handlePurgeAll}
        onCancel={() => setIsPurgeAllOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!purgeTarget}
        title="Supprimer définitivement"
        message={`Supprimer définitivement « ${purgeTarget?.label} » ? Cette action est irréversible : l'élément ne pourra plus être restauré.`}
        confirmLabel="Supprimer définitivement"
        variant="danger"
        onConfirm={handlePurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </div>
  );
}
