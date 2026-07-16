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
  slug: string | null;
  isSystem: boolean;
  isPublic: boolean;
  confirmationSubjectFr: string | null;
  confirmationSubjectEn: string | null;
  confirmationBodyFr: string | null;
  confirmationBodyEn: string | null;
  messagesCount: number;
}

interface FormState {
  nameFr: string;
  nameEn: string;
  emailRecipients: string;
  sortOrder: string;
  isActive: boolean;
  slug: string;
  confirmationSubjectFr: string;
  confirmationSubjectEn: string;
  confirmationBodyFr: string;
  confirmationBodyEn: string;
}

const emptyForm: FormState = {
  nameFr: "", nameEn: "", emailRecipients: "", sortOrder: "0", isActive: true,
  slug: "", confirmationSubjectFr: "", confirmationSubjectEn: "",
  confirmationBodyFr: "", confirmationBodyEn: "",
};

export default function ContactCategories() {
  const [categories, setCategories] = useState<ContactCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingIsSystem, setEditingIsSystem] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    setEditingIsSystem(cat.isSystem);
    setForm({
      nameFr: cat.nameFr, nameEn: cat.nameEn, emailRecipients: cat.emailRecipients,
      sortOrder: String(cat.sortOrder), isActive: cat.isActive, slug: cat.slug || "",
      confirmationSubjectFr: cat.confirmationSubjectFr || "",
      confirmationSubjectEn: cat.confirmationSubjectEn || "",
      confirmationBodyFr: cat.confirmationBodyFr || "",
      confirmationBodyEn: cat.confirmationBodyEn || "",
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setEditingIsSystem(false);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const payload = {
      nameFr: form.nameFr, nameEn: form.nameEn, emailRecipients: form.emailRecipients,
      sortOrder: Number(form.sortOrder), isActive: form.isActive,
      slug: form.slug || undefined,
      confirmationSubjectFr: form.confirmationSubjectFr || undefined,
      confirmationSubjectEn: form.confirmationSubjectEn || undefined,
      confirmationBodyFr: form.confirmationBodyFr || undefined,
      confirmationBodyEn: form.confirmationBodyEn || undefined,
    };

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
    setDeleteError(null);
    const { status } = await adminFetch(`/contact/categories/${deleteTarget.id}`, { method: "DELETE" });
    if (status === 409) {
      setDeleteError("Les catégories système ne peuvent pas être supprimées.");
      return;
    }
    setDeleteTarget(null);
    loadCategories();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={startNew} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90">Nouvelle catégorie</button>
      </div>

      {showForm && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">{editingId ? "Modifier" : "Nouvelle catégorie"}</h2>
          <BilingualInput label="Nom" nameFr="nameFr" nameEn="nameEn" valueFr={form.nameFr} valueEn={form.nameEn} onChangeFr={(v) => setForm({ ...form, nameFr: v })} onChangeEn={(v) => setForm({ ...form, nameEn: v })} required />
          <FormField label="Destinataires (emails séparés par virgule)" name="emailRecipients" value={form.emailRecipients} onChange={(v) => setForm({ ...form, emailRecipients: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Slug" name="slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} helpText="Identifiant stable (ex: sponsoring, cfp)" disabled={editingIsSystem} />
            <FormField label="Ordre" name="sortOrder" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gris/30" />
            <span className="text-sm text-noir">Active</span>
          </div>

          {/* Confirmation email template */}
          <div className="pt-4 border-t border-gris/20">
            <h3 className="text-sm font-bold text-noir mb-3">Email de confirmation (envoyé à l&apos;expéditeur du formulaire)</h3>
            <p className="text-xs text-gris mb-3">Variables disponibles : <code className="bg-blanc-casse px-1 rounded">{"{firstName}"}</code> <code className="bg-blanc-casse px-1 rounded">{"{lastName}"}</code> <code className="bg-blanc-casse px-1 rounded">{"{brochureUrl}"}</code></p>
            <BilingualInput label="Objet" nameFr="confirmationSubjectFr" nameEn="confirmationSubjectEn" valueFr={form.confirmationSubjectFr} valueEn={form.confirmationSubjectEn} onChangeFr={(v) => setForm({ ...form, confirmationSubjectFr: v })} onChangeEn={(v) => setForm({ ...form, confirmationSubjectEn: v })} />
            <div className="mt-3">
              <BilingualInput label="Contenu" nameFr="confirmationBodyFr" nameEn="confirmationBodyEn" valueFr={form.confirmationBodyFr} valueEn={form.confirmationBodyEn} onChangeFr={(v) => setForm({ ...form, confirmationBodyFr: v })} onChangeEn={(v) => setForm({ ...form, confirmationBodyEn: v })} multiline rows={5} />
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
              <th className="text-left px-4 py-3 font-medium text-gris">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Destinataires</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Messages</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Active</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Confirmation</th>
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                <td className="px-4 py-3 text-noir font-medium">
                  {cat.nameFr}
                  {cat.isSystem && <span className="ml-2 text-[10px] bg-bleu/10 text-bleu px-1.5 py-0.5 rounded">système</span>}
                  {!cat.isPublic && <span className="ml-2 text-[10px] bg-gris/10 text-gris px-1.5 py-0.5 rounded" title="Non proposée dans le formulaire générique /contact ; utilisée par une page dédiée.">interne</span>}
                </td>
                <td className="px-4 py-3 text-gris text-xs font-mono">{cat.slug || "—"}</td>
                <td className="px-4 py-3 text-gris text-xs">{cat.emailRecipients}</td>
                <td className="px-4 py-3 text-noir">{cat.messagesCount}</td>
                <td className="px-4 py-3">{cat.isActive ? <span className="text-malachite">Oui</span> : <span className="text-gris">Non</span>}</td>
                <td className="px-4 py-3">{cat.confirmationSubjectFr ? <span className="text-malachite text-xs">✓ configurée</span> : <span className="text-gris text-xs">—</span>}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(cat)} className="text-bleu hover:underline text-sm">Modifier</button>
                  {!cat.isSystem && (
                    <button onClick={() => setDeleteTarget(cat)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer la catégorie"
        message={deleteError || `Supprimer "${deleteTarget?.nameFr}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
      />
    </div>
  );
}
