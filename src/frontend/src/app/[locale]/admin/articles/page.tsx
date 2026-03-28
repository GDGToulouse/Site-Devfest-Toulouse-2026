"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
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
}

interface ArticlesResponse {
  articles: ArticleSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ArticlesListPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ArticleSummary | null>(null);

  async function loadArticles(p = 1) {
    setIsLoading(true);
    const { data } = await adminFetch<ArticlesResponse>(`/articles?page=${p}&limit=20`);
    if (data) {
      setArticles(data.articles);
      setTotalPages(data.totalPages);
      setPage(data.page);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadArticles();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/articles/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadArticles(page);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Articles</h1>
        <Link
          href="/fr/admin/articles/new"
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          Nouvel article
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gris">Chargement...</p>
      ) : articles.length === 0 ? (
        <p className="text-gris py-8 text-center">Aucun article</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                    <td className="px-4 py-3">
                      <Link href={`/fr/admin/articles/${article.id}`} className="text-noir font-medium hover:text-malachite">
                        {article.titleFr}
                      </Link>
                      <p className="text-xs text-gris mt-1">/{article.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={article.publicationStatus === "PUBLISHED" ? "Publie" : "Brouillon"}
                        variant={article.publicationStatus === "PUBLISHED" ? "green" : "gray"}
                      />
                    </td>
                    <td className="px-4 py-3 text-gris">{article.author || "-"}</td>
                    <td className="px-4 py-3 text-gris text-xs">
                      {new Date(article.publishedAt || article.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link href={`/fr/admin/articles/${article.id}`} className="text-bleu hover:underline text-sm">
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

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => loadArticles(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    p === page ? "bg-malachite text-blanc" : "bg-blanc text-gris hover:bg-blanc-casse"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'article"
        message={`Supprimer "${deleteTarget?.titleFr}" ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
