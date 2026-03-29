"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import BilingualInput from "@/components/admin/BilingualInput";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface TicketTier {
  id: number;
  nameFr: string;
  nameEn: string;
  price: number;
  status: string;
  externalUrl: string | null;
  sortOrder: number;
  editionId: number;
  editionYear: number;
}

interface Edition {
  id: number;
  year: number;
}

const TICKET_STATUS = [
  { value: "COMING_SOON", label: "Bientot disponible", variant: "gray" as const },
  { value: "AVAILABLE", label: "Disponible", variant: "green" as const },
  { value: "SOLD_OUT", label: "Complet", variant: "orange" as const },
];

const emptyTier = {
  nameFr: "",
  nameEn: "",
  price: "",
  status: "COMING_SOON",
  externalUrl: "",
  sortOrder: "0",
  editionId: "",
};

export default function TicketingPage() {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTier);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketTier | null>(null);

  async function loadData() {
    setIsLoading(true);
    const [tiersRes, editionsRes] = await Promise.all([
      adminFetch<TicketTier[]>("/tickets"),
      adminFetch<Edition[]>("/editions"),
    ]);
    if (tiersRes.data) setTiers(tiersRes.data);
    if (editionsRes.data) setEditions(editionsRes.data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function startEdit(tier: TicketTier) {
    setEditingId(tier.id);
    setForm({
      nameFr: tier.nameFr,
      nameEn: tier.nameEn,
      price: String(tier.price),
      status: tier.status,
      externalUrl: tier.externalUrl || "",
      sortOrder: String(tier.sortOrder),
      editionId: String(tier.editionId),
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    const defaultEdition = editions[0];
    setForm({ ...emptyTier, editionId: defaultEdition ? String(defaultEdition.id) : "" });
    setShowForm(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const payload = {
      nameFr: form.nameFr,
      nameEn: form.nameEn,
      price: Number(form.price) || 0,
      status: form.status,
      externalUrl: form.externalUrl || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      editionId: Number(form.editionId),
    };

    if (editingId) {
      await adminFetch(`/tickets/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/tickets", { method: "POST", body: JSON.stringify(payload) });
    }

    setIsSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/tickets/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadData();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Billetterie</h1>
        <button onClick={startNew} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90">
          Nouveau tarif
        </button>
      </div>

      {showForm && (
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-noir">{editingId ? "Modifier le tarif" : "Nouveau tarif"}</h2>

          <BilingualInput label="Nom" nameFr="nameFr" nameEn="nameEn" valueFr={form.nameFr} valueEn={form.nameEn} onChangeFr={(v) => setForm({ ...form, nameFr: v })} onChangeEn={(v) => setForm({ ...form, nameEn: v })} required />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Prix (EUR)" name="price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50">
                {TICKET_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Edition</label>
              <select value={form.editionId} onChange={(e) => setForm({ ...form, editionId: e.target.value })} className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50">
                {editions.map((e) => <option key={e.id} value={e.id}>{e.year}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="URL externe" name="externalUrl" type="url" value={form.externalUrl} onChange={(v) => setForm({ ...form, externalUrl: v })} />
            <FormField label="Ordre" name="sortOrder" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse">Annuler</button>
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl shadow-card bg-blanc">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blanc-casse/60 border-b border-gris/20">
              <th className="text-left px-4 py-3 font-medium text-gris">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Prix</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-gris">Edition</th>
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                <td className="px-4 py-3 text-noir font-medium">{tier.nameFr}</td>
                <td className="px-4 py-3 text-noir">{tier.price} EUR</td>
                <td className="px-4 py-3">
                  <StatusBadge status={TICKET_STATUS.find((s) => s.value === tier.status)?.label || tier.status} variant={TICKET_STATUS.find((s) => s.value === tier.status)?.variant || "gray"} />
                </td>
                <td className="px-4 py-3 text-gris">{tier.editionYear}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(tier)} className="text-bleu hover:underline text-sm">Modifier</button>
                  <button onClick={() => setDeleteTarget(tier)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Supprimer le tarif" message={`Supprimer "${deleteTarget?.nameFr}" ?`} confirmLabel="Supprimer" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
