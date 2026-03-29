"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "EDITOR";
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "EDITOR" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [editingRole, setEditingRole] = useState<{ id: string; role: string } | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    const { data } = await adminFetch<AdminUser[]>("/users");
    if (data) setUsers(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate() {
    if (!form.email || !form.name) {
      setError("Email et nom sont requis");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { status, data } = await adminFetch<{ error?: string }>("/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (status === 409) {
      setError("Un utilisateur avec cet email existe deja");
    } else if (status !== 201) {
      setError(data?.error || "Erreur lors de la creation");
    } else {
      setShowForm(false);
      setForm({ email: "", name: "", role: "EDITOR" });
    }
    setIsSaving(false);
    loadUsers();
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await adminFetch(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role: newRole }),
    });
    setEditingRole(null);
    loadUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { status, data } = await adminFetch<{ error?: string }>(`/users/${deleteTarget.id}`, { method: "DELETE" });
    if (status === 400) {
      setError(data?.error || "Impossible de supprimer cet utilisateur");
    }
    setDeleteTarget(null);
    loadUsers();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

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
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      {showForm && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">Inviter un utilisateur</h2>
          <p className="text-sm text-gris">Un email d&apos;invitation sera envoye. L&apos;utilisateur definira son mot de passe via &quot;Mot de passe oublie&quot;.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Nom" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <FormField label="Email" name="email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              >
                <option value="EDITOR">Editeur</option>
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

      <div className="overflow-x-auto rounded-xl shadow-card bg-blanc">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blanc-casse/60 border-b border-gris/20">
              <th className="text-left px-4 py-3 font-medium text-gris">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Derniere connexion</th>
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                <td className="px-4 py-3 text-noir font-medium">{user.name || "-"}</td>
                <td className="px-4 py-3 text-gris">{user.email}</td>
                <td className="px-4 py-3">
                  {editingRole?.id === user.id ? (
                    <select
                      value={editingRole.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                      className="rounded border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-1 focus:ring-malachite/50"
                    >
                      <option value="ADMIN">Administrateur</option>
                      <option value="EDITOR">Editeur</option>
                    </select>
                  ) : (
                    <button onClick={() => setEditingRole({ id: user.id, role: user.role })}>
                      <StatusBadge
                        status={user.role === "ADMIN" ? "Administrateur" : "Editeur"}
                        variant={user.role === "ADMIN" ? "green" : "blue"}
                      />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-gris text-xs">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString("fr-FR") : "Jamais"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setDeleteTarget(user)}
                    className="text-terre-cuite hover:underline text-sm"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'utilisateur"
        message={`Supprimer ${deleteTarget?.name || deleteTarget?.email} ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
