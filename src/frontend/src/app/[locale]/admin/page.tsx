"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface DashboardStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  unreadMessages: number;
  editionStatus: string;
  editionYear: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      const [articlesRes, messagesRes, editionRes] = await Promise.all([
        adminFetch<{ total: number; articles: { publicationStatus: string }[] }>("/articles?limit=100"),
        adminFetch<{ total: number; messages: { isRead: boolean }[] }>("/contact/messages?limit=1"),
        // Use public API for edition (accessible to all roles)
        fetch(`${BACKEND_URL}/api/editions/current`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      setStats({
        totalArticles: articlesRes.data?.total || 0,
        publishedArticles: 0,
        draftArticles: 0,
        unreadMessages: messagesRes.data?.total || 0,
        editionStatus: editionRes?.status || "UNKNOWN",
        editionYear: editionRes?.year || 2026,
      });
    }

    loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-8">Dashboard</h1>

      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Articles" value={String(stats.totalArticles)} color="bleu" />
          <StatCard label="Messages non lus" value={String(stats.unreadMessages)} color="terre-cuite" />
          <StatCard label="Edition" value={String(stats.editionYear)} color="malachite" />
          <StatCard label="Statut" value={formatStatus(stats.editionStatus)} color="noir" />
        </div>
      ) : (
        <p className="text-gris">Chargement...</p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-blanc rounded-xl shadow-card p-6">
      <p className="text-sm text-gris">{label}</p>
      <p className={`mt-2 text-3xl font-bold text-${color}`}>{value}</p>
    </div>
  );
}

function formatStatus(status: string): string {
  switch (status) {
    case "PREPARATION": return "Preparation";
    case "ANNOUNCEMENT": return "Annonce";
    case "SEE_YOU_NEXT_YEAR": return "A l'annee prochaine";
    default: return status;
  }
}
