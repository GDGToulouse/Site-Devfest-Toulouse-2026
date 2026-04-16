"use client";

import { useState, useEffect, useCallback } from "react";

import {
  adminListApiKeys,
  adminRevokeApiKey,
  type AdminApiKeysList,
  type ApiKeyWithUser,
} from "@/lib/admin-api";

function formatDate(iso: string | null, placeholder = "—") {
  if (!iso) return placeholder;
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusLabel(key: ApiKeyWithUser): { label: string; className: string } {
  if (key.revokedAt) return { label: "Révoquée", className: "bg-gris/10 text-gris" };
  if (key.expiresAt && new Date(key.expiresAt) <= new Date()) {
    return { label: "Expirée", className: "bg-gris/10 text-gris" };
  }
  return { label: "Active", className: "bg-malachite/10 text-malachite" };
}

export default function AdminApiKeysPage() {
  const [list, setList] = useState<AdminApiKeysList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("active");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const data = await adminListApiKeys({ status: statusFilter, page, limit: 20 });
    if (!data) setError("Impossible de charger les clés");
    setList(data);
    setIsLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id: string) {
    if (!confirm("Révoquer cette clé ? Le propriétaire ne pourra plus l'utiliser.")) return;
    const ok = await adminRevokeApiKey(id);
    if (!ok) setError("Révocation impossible");
    await load();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-2">Clés API</h1>
      <p className="text-gris mb-6">
        Vue d&apos;ensemble de toutes les clés d&apos;API. Vous pouvez révoquer n&apos;importe quelle clé à tout moment.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-noir">Statut :</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "revoked");
            setPage(1);
          }}
          className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm bg-blanc"
        >
          <option value="active">Actives</option>
          <option value="revoked">Révoquées</option>
          <option value="all">Toutes</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{error}</div>
      )}

      {isLoading ? (
        <p className="text-sm text-gris py-12 text-center">Chargement...</p>
      ) : !list || list.items.length === 0 ? (
        <div className="bg-blanc rounded-xl shadow-card p-12 text-center text-gris">
          Aucune clé correspondant aux critères.
        </div>
      ) : (
        <div className="bg-blanc rounded-xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gris/20">
                <th className="py-3 px-4 text-noir font-medium">Propriétaire</th>
                <th className="py-3 px-4 text-noir font-medium">Nom</th>
                <th className="py-3 px-4 text-noir font-medium">Préfixe</th>
                <th className="py-3 px-4 text-noir font-medium">Statut</th>
                <th className="py-3 px-4 text-noir font-medium">Dernière utilisation</th>
                <th className="py-3 px-4 text-noir font-medium">Expiration</th>
                <th className="py-3 px-4 text-noir font-medium">Créée le</th>
                <th className="py-3 px-4 text-right text-noir font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((k) => {
                const status = statusLabel(k);
                return (
                  <tr key={k.id} className="border-b border-gris/10 last:border-b-0">
                    <td className="py-3 px-4">
                      <div className="text-noir">{k.user.name ?? k.user.email}</div>
                      {k.user.name && <div className="text-xs text-gris">{k.user.email}</div>}
                      <div className="text-xs text-gris mt-0.5">
                        {k.user.role === "ADMIN" ? "Administrateur" : "Éditeur"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-noir">{k.name}</td>
                    <td className="py-3 px-4">
                      <code className="text-xs font-mono text-gris">{k.prefix}…</code>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gris">{formatDate(k.lastUsedAt, "Jamais")}</td>
                    <td className="py-3 px-4 text-gris">{formatDate(k.expiresAt)}</td>
                    <td className="py-3 px-4 text-gris">{formatDate(k.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      {!k.revokedAt && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          className="text-terre-cuite hover:underline text-sm"
                        >
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {list && list.total > list.limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gris">
            {(list.page - 1) * list.limit + 1}–{Math.min(list.page * list.limit, list.total)} sur {list.total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={list.page <= 1}
              className="px-3 py-1.5 text-sm bg-blanc border border-gris/30 rounded-lg disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={list.page * list.limit >= list.total}
              className="px-3 py-1.5 text-sm bg-blanc border border-gris/30 rounded-lg disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
