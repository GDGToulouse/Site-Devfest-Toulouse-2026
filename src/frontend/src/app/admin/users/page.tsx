"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminFetch, humanError } from "@/lib/admin-api";
import { useListParams } from "@/lib/use-list-params";
import ListPagination from "@/components/admin/ListPagination";
import FormField from "@/components/admin/FormField";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type UserRole = "ADMIN" | "EDITOR" | "SPONSOR";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  banned: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
  sponsors: { id: number; name: string }[];
}

// A sponsor contact is not part of the team (#500): its own badge, and no role
// change from here — its rights live on the sponsor's contact.
const ROLE_BADGES: Record<UserRole, { label: string; variant: "green" | "blue" | "gray" }> = {
  ADMIN: { label: "Administrateur", variant: "green" },
  EDITOR: { label: "Éditeur", variant: "blue" },
  SPONSOR: { label: "Sponsor", variant: "gray" },
};

interface UserPage {
  page: number;
  limit: number;
  total: number;
  items: AdminUser[];
}

const PAGE_SIZE = 50;
// Long enough not to query on every key, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;
const LIST_KEYS = ["search", "role"] as const;

const SELECT_CLASS =
  "rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function UsersAdminPage() {
  // A page at a time (#416): every sponsor contact has an account (#362), so
  // the list grows with the partners, not with the team.
  const { params, page, update } = useListParams(LIST_KEYS);
  const [list, setList] = useState<UserPage | null>(null);
  const [searchInput, setSearchInput] = useState(params.search);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "EDITOR" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [editingRôle, setEditingRôle] = useState<{ id: string; role: string } | null>(null);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  const queryString = query.toString();

  const loadUsers = useCallback(async () => {
    const { data } = await adminFetch<UserPage>(`/users?${queryString}`);
    setList(data ?? { page: 1, limit: PAGE_SIZE, total: 0, items: [] });
  }, [queryString]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (searchInput === params.search) return;
    const timer = setTimeout(() => update({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, params.search, update]);

  async function handleCreate() {
    if (!form.email || !form.name) {
      setError("Email et nom sont requis");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { status, error: apiError } = await adminFetch("/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (status === 409) {
      setError("Un utilisateur avec cet email existe déjà");
    } else if (status !== 201) {
      setError(apiError || "Erreur lors de la création");
    } else {
      setShowForm(false);
      setForm({ email: "", name: "", role: "EDITOR" });
    }
    setIsSaving(false);
    loadUsers();
  }

  async function handleToggleBan(userId: string) {
    const { status, error: apiError } = await adminFetch(`/users/${userId}/ban`, { method: "PUT" });
    if (status === 400) {
      setError(apiError || "Impossible de bloquer cet utilisateur");
    }
    loadUsers();
  }

  async function handleRôleChange(userId: string, newRôle: string) {
    const result = await adminFetch(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role: newRôle }),
    });
    // Success is 200 only: status 0 means the request never reached the
    // backend, and a refusal must stay on screen (#394, #428).
    setError(result.status === 200 ? null : humanError(result, "Le rôle n'a pas pu être modifié. Réessayez."));
    setEditingRôle(null);
    loadUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { status, error: apiError } = await adminFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
    if (status === 400) {
      setError(apiError || "Impossible de supprimer cet utilisateur");
    }
    setDeleteTarget(null);
    // The last row of a page gone: step back rather than show an empty page.
    if (status === 200 && list && list.items.length === 1 && page > 1) update({ page: String(page - 1) });
    else loadUsers();
  }

  if (!list) return <p className="text-gris">Chargement...</p>;
  const users = list.items;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Utilisateurs</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          {showForm ? "Annuler" : "Inviter"}
        </button>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      {showForm && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">Inviter un utilisateur</h2>
          <p className="text-sm text-gris">Un email d&apos;invitation sera envoyé. L&apos;utilisateur définira son mot de passe via &quot;Mot de passe oublié&quot;.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Nom" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <FormField label="Email" name="email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              >
                <option value="EDITOR">Éditeur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Envoi..." : "Envoyer l'invitation"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Rechercher"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un nom ou un email…"
          className="w-72 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <select aria-label="Rôle" value={params.role} onChange={(e) => update({ role: e.target.value })} className={SELECT_CLASS}>
          <option value="">Tous les rôles</option>
          <option value="ADMIN">Administrateurs</option>
          <option value="EDITOR">Éditeurs</option>
          <option value="SPONSOR">Sponsors</option>
        </select>
        <span className="text-sm text-gris" aria-live="polite">
          {list.total} utilisateur{list.total > 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-xl shadow-card bg-blanc">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blanc-casse/60 border-b border-gris/20">
              <th className="text-left px-4 py-3 font-medium text-gris">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Dernière connexion</th>
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={`border-b border-gris/10 ${user.banned ? "opacity-50" : "hover:bg-blanc-casse/50"}`}>
                <td className="px-4 py-3 text-noir font-medium">
                  {user.name || "-"}
                  {user.banned && <span className="ml-2 text-xs text-terre-cuite">(bloqué)</span>}
                </td>
                <td className="px-4 py-3 text-gris">{user.email}</td>
                <td className="px-4 py-3">
                  {editingRôle?.id === user.id ? (
                    <select
                      value={editingRôle.role}
                      onChange={(e) => handleRôleChange(user.id, e.target.value)}
                      onBlur={() => setEditingRôle(null)}
                      autoFocus
                      className="rounded border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-1 focus:ring-malachite/50"
                    >
                      <option value="ADMIN">Administrateur</option>
                      <option value="EDITOR">Éditeur</option>
                    </select>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge status={ROLE_BADGES[user.role].label} variant={ROLE_BADGES[user.role].variant} />
                      {user.sponsors.map((sponsor, i) => (
                        <span key={sponsor.id} className="text-xs text-gris">
                          <Link href={`/admin/sponsors/${sponsor.id}`} className="text-bleu hover:underline">
                            {sponsor.name}
                          </Link>
                          {i < user.sponsors.length - 1 && ","}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gris text-xs">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString("fr-FR") : "Jamais"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {user.role !== "SPONSOR" && (
                      <button
                        onClick={() => setEditingRôle({ id: user.id, role: user.role })}
                        className="p-2 rounded-lg text-bleu hover:bg-bleu/10 transition-colors"
                        title="Modifier le rôle"
                        // A title alone is not read reliably: name the account (#499).
                        aria-label={`Modifier le rôle de ${user.email}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleBan(user.id)}
                      className={`p-2 rounded-lg transition-colors ${user.banned ? "text-malachite hover:bg-malachite/10" : "text-orange hover:bg-orange/10"}`}
                      title={user.banned ? "Débloquer" : "Bloquer"}
                      aria-label={`${user.banned ? "Débloquer" : "Bloquer"} ${user.email}`}
                    >
                      {user.banned ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="p-2 rounded-lg text-terre-cuite hover:bg-terre-cuite/10 transition-colors"
                      title="Supprimer"
                      aria-label={`Supprimer ${user.email}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="px-4 py-6 text-center text-sm text-gris">Aucun utilisateur ne correspond.</p>}
      </div>

      <ListPagination page={list.page} limit={list.limit} total={list.total} onPageChange={(next) => update({ page: String(next) })} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'utilisateur"
        message={`Supprimer ${deleteTarget?.name || deleteTarget?.email} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
