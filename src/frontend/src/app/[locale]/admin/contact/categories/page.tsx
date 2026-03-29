"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import BilingualInput from "@/components/admin/BilingualInput";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface ContactCategory {
  id: number;
  nameFr: string;
  nameEn: string;
  emailRecipients: string;
  sortOrder: number;
  isActive: boolean;
  messagesCount: number;
}

const emptyCategory = { nameFr: "", nameEn: "", emailRecipients: "", sortOrder: "0", isActive: true };

export default function ContactCategoriesPage() {
  const [categories, setCategories] = useState<ContactCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCategory);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactCategory | null>(null);

  async function loadCategories() {
    setIsLoading(true);
    const { data } = await adminFetch<ContactCategory[]>("/contact/categories");
    if (data) setCategories(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function startEdit(cat: ContactCategory) {
    setEditingId(cat.id);
    setForm({ nameFr: cat.nameFr, nameEn: cat.nameEn, emailRecipients: cat.emailRecipients, sortOrder: String(cat.sortOrder), isActive: cat.isActive });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyCategory);
    setShowForm(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const payload = { nameFr: form.nameFr, nameEn: form.nameEn, emailRecipients: form.emailRecipients, sortOrder: Number(form.sortOrder), isActive: form.isActive };

    if (editingId) {
      await adminFetch(`/contact/categories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/contact/categories", { method: "POST", body: JSON.stringify(payload) });
    }

    setIsSaving(false);
    setShowForm(false);
    loadCategories();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/contact/categories/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadCategories();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Categories de contact</h1>
        <button onClick={startNew} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90">Nouvelle categorie</button>
      </div>

      {showForm && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">{editingId ? "Modifier" : "Nouvelle categorie"}</h2>
          <BilingualInput label="Nom" nameFr="nameFr" nameEn="nameEn" valueFr={form.nameFr} valueEn={form.nameEn} onChangeFr={(v) => setForm({ ...form, nameFr: v })} onChangeEn={(v) => setForm({ ...form, nameEn: v })} required />
          <FormField label="Destinataires (emails separes par virgule)" name="emailRecipients" value={form.emailRecipients} onChange={(v) => setForm({ ...form, emailRecipients: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Ordre" name="sortOrder" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gris/30" />
              <span className="text-sm text-noir">Active</span>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse">Annuler</button>
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">{isSaving ? "Sauvegarde..." : "Sauvegarder"}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl shadow-card bg-blanc">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blanc-casse/60 border-b border-gris/20">
              <th className="text-left px-4 py-3 font-medium text-gris">Nom (FR)</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Destinataires</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Messages</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Active</th>
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                <td className="px-4 py-3 text-noir font-medium">{cat.nameFr}</td>
                <td className="px-4 py-3 text-gris text-xs">{cat.emailRecipients}</td>
                <td className="px-4 py-3 text-noir">{cat.messagesCount}</td>
                <td className="px-4 py-3">{cat.isActive ? <span className="text-malachite">Oui</span> : <span className="text-gris">Non</span>}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(cat)} className="text-bleu hover:underline text-sm">Modifier</button>
                  <button onClick={() => setDeleteTarget(cat)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Supprimer la categorie" message={`Supprimer "${deleteTarget?.nameFr}" ?`} confirmLabel="Supprimer" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
