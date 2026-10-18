"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { useListParams } from "@/lib/use-list-params";
import ListPagination from "@/components/admin/ListPagination";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface ArticleSummary {
  id: number;
  slug: string;
  titleFr: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
  tags: { id: number; name: string }[];
  editions: { id: number; year: number }[];
}

interface ArticlesResponse {
  articles: ArticleSummary[];
  total: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 20;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;
const LIST_KEYS = ["search", "status"] as const;

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function ArticlesListPage() {
  // The page lives in the URL, like the other admin lists (#416): coming back
  // from an article lands on the page it was opened from.
  const { params, page, update } = useListParams(LIST_KEYS);
  const [searchInput, setSearchInput] = useState(params.search);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ArticleSummary | null>(null);
  const [error, setError] = useState("");

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    const { data } = await adminFetch<ArticlesResponse>(`/articles?${query.toString()}`);
    if (data) {
      setArticles(data.articles);
      setTotal(data.total);
    }
    setIsLoading(false);
  }, [page, params.search, params.status]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setError("");
    const { status } = await adminFetch(`/articles/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    // A refused delete closed the dialog and reloaded the list, so the article
    // reappeared with nothing said about why (#412).
    if (status !== 204 && status !== 200) {
      setError("La suppression a échoué. Réessayez.");
      return;
    }
    // The last article of a page gone: step back, or the list read "Aucun
    // article" while earlier pages still held some (#416).
    if (articles.length === 1 && page > 1) update({ page: String(page - 1) });
    else loadArticles();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Articles</h1>
        <Link
          href={`/admin/articles/new`}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          Nouvel article
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un titre ou un auteur…"
          className="w-72 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select aria-label="Statut" value={params.status} onChange={(e) => update({ status: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publié</option>
          <option value="DRAFT">Brouillon</option>
        </select>
        {!isLoading && (
          <span className="text-sm text-gris" aria-live="polite">
            {total} article{total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="mb-6 rounded-xl bg-terre-cuite/10 p-4 text-sm text-terre-cuite">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-gris">Chargement…</p>
      ) : articles.length === 0 ? (
        <p className="text-gris py-8 text-center">
          {params.search || params.status ? "Aucun article ne correspond à ces filtres" : "Aucun article"}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto overflow-y-hidden rounded-xl shadow-card bg-blanc">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse/60 border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Éditions</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/articles/${article.id}`} className="text-noir font-medium hover:text-malachite">
                        {article.titleFr}
                      </Link>
                      <p className="text-xs text-gris mt-1">/{article.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={article.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
                        variant={article.publicationStatus === "PUBLISHED" ? "green" : "gray"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {article.editions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {article.editions.map((ed) => (
                            <span key={ed.id} className="inline-block px-2 py-0.5 text-xs rounded bg-malachite/10 text-malachite">
                              {ed.year}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gris">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gris">{article.author || "-"}</td>
                    <td className="px-4 py-3 text-gris text-xs">
                      {new Date(article.publishedAt || article.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link href={`/fr/actualites/${article.slug}`} target="_blank" className="text-gris hover:underline text-sm">
                        Prévisualiser
                      </Link>
                      <Link href={`/admin/articles/${article.id}`} className="text-bleu hover:underline text-sm">
                        Modifier
                      </Link>
                      <button onClick={() => setDeleteTarget(article)} className="text-terre-cuite hover:underline text-sm">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ListPagination page={page} limit={PAGE_SIZE} total={total} onPageChange={(next) => update({ page: String(next) })} />
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'article"
        message={`Supprimer « ${deleteTarget?.titleFr} » ? Il disparaîtra des actualités. Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
