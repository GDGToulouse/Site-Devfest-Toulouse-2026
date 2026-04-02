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
}

interface BilletwebEvent {
  id: string;
  name: string;
  date: string;
  shop: string;
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
};

interface TicketingTabProps {
  editionId: number;
}

export default function TicketingTab({ editionId }: TicketingTabProps) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTier);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketTier | null>(null);

  // Billetweb import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [bwEvents, setBwEvents] = useState<BilletwebEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<BilletwebEvent | null>(null);

  async function loadTiers() {
    setIsLoading(true);
    const { data } = await adminFetch<TicketTier[]>(`/tickets?editionId=${editionId}`);
    if (data) setTiers(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadTiers();
  }, [editionId]);

  function startEdit(tier: TicketTier) {
    setEditingId(tier.id);
    setForm({
      nameFr: tier.nameFr,
      nameEn: tier.nameEn,
      price: String(tier.price),
      status: tier.status,
      externalUrl: tier.externalUrl || "",
      sortOrder: String(tier.sortOrder),
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm({ ...emptyTier });
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
      editionId,
    };

    if (editingId) {
      await adminFetch(`/tickets/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/tickets", { method: "POST", body: JSON.stringify(payload) });
    }

    setIsSaving(false);
    setShowForm(false);
    loadTiers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/tickets/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadTiers();
  }

  // Billetweb import
  async function openImportModal() {
    setShowImportModal(true);
    setImportError(null);
    setSelectedEvent(null);
    setIsLoadingEvents(true);

    const { data, status } = await adminFetch<BilletwebEvent[]>("/tickets/billetweb/events");
    if (status === 200 && data) {
      setBwEvents(data);
    } else {
      setImportError("Impossible de charger les evenements Billetweb. Verifiez la configuration API.");
      setBwEvents([]);
    }
    setIsLoadingEvents(false);
  }

  async function handleImport() {
    if (!selectedEvent) return;
    setIsImporting(true);
    setImportError(null);

    const { data, status } = await adminFetch<{ imported: number }>("/tickets/import/billetweb", {
      method: "POST",
      body: JSON.stringify({ editionId, billetwebEventId: selectedEvent.id }),
    });

    setIsImporting(false);

    if (status === 201 && data) {
      setShowImportModal(false);
      setSelectedEvent(null);
      loadTiers();
    } else {
      setImportError("Erreur lors de l'import des tarifs.");
    }
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-noir">Tarifs</h3>
        <div className="flex gap-3">
          <button
            onClick={openImportModal}
            className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90"
          >
            Importer depuis Billetweb
          </button>
          <button onClick={startNew} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90">
            Nouveau tarif
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-blanc-casse/50 rounded-xl p-6 mb-6 space-y-4">
          <h4 className="text-sm font-bold text-noir">{editingId ? "Modifier le tarif" : "Nouveau tarif"}</h4>

          <BilingualInput label="Nom" nameFr="nameFr" nameEn="nameEn" valueFr={form.nameFr} valueEn={form.nameEn} onChangeFr={(v) => setForm({ ...form, nameFr: v })} onChangeEn={(v) => setForm({ ...form, nameEn: v })} required />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Prix (EUR)" name="price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50">
                {TICKET_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <FormField label="Ordre" name="sortOrder" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
          </div>

          <FormField label="URL externe" name="externalUrl" type="url" value={form.externalUrl} onChange={(v) => setForm({ ...form, externalUrl: v })} />

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse">Annuler</button>
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {tiers.length === 0 ? (
        <p className="text-gris text-sm">Aucun tarif pour cette edition.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gris/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blanc-casse/60 border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-gris">Prix</th>
                <th className="text-left px-4 py-3 font-medium text-gris">Statut</th>
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
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => startEdit(tier)} className="text-bleu hover:underline text-sm">Modifier</button>
                    <button onClick={() => setDeleteTarget(tier)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} title="Supprimer le tarif" message={`Supprimer "${deleteTarget?.nameFr}" ?`} confirmLabel="Supprimer" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* Billetweb import modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir/50">
          <div className="bg-blanc rounded-xl shadow-card w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gris/20">
              <h3 className="text-lg font-bold text-noir">Importer depuis Billetweb</h3>
              <p className="text-sm text-gris mt-1">
                Selectionnez un evenement. Les tarifs existants seront remplaces.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingEvents && <p className="text-gris text-sm">Chargement des evenements...</p>}

              {importError && (
                <div className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
                  {importError}
                </div>
              )}

              {!isLoadingEvents && bwEvents.length === 0 && !importError && (
                <p className="text-gris text-sm">Aucun evenement trouve.</p>
              )}

              {bwEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 border transition-colors ${
                    selectedEvent?.id === event.id
                      ? "border-malachite bg-malachite/5"
                      : "border-gris/20 hover:bg-blanc-casse"
                  }`}
                >
                  <p className="font-medium text-noir text-sm">{event.name}</p>
                  <p className="text-xs text-gris mt-0.5">
                    {event.date ? new Date(event.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Date non definie"}
                  </p>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gris/20 flex gap-3 justify-end">
              <button
                onClick={() => { setShowImportModal(false); setSelectedEvent(null); }}
                className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
              >
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedEvent || isImporting}
                className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
              >
                {isImporting ? "Import en cours..." : "Importer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
