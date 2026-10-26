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
  isVisible: boolean;
  saleStartDate: string | null;
  saleEndDate: string | null;
  status: string;
  manualStatus: string | null;
  isSoldOut: boolean | null;
  externalUrl: string | null;
  sortOrder: number;
  billetwebTicketId: string | null;
  isOutsideFlow: boolean;
}

interface BilletwebLink {
  billetwebEventId: string | null;
  billetwebEventName: string | null;
}

interface BilletwebEvent {
  id: string;
  name: string;
  date: string;
  shop: string;
}

const TICKET_STATUS = [
  { value: "COMING_SOON", label: "Bientôt disponible", variant: "gray" as const },
  { value: "AVAILABLE", label: "Disponible", variant: "green" as const },
  { value: "SOLD_OUT", label: "Complet", variant: "orange" as const },
];

// Admin override choices. "AUTO" clears the override → status is derived from
// the BilletWeb sync and sale dates.
const MANUAL_STATUS_OPTIONS = [
  { value: "AUTO", label: "Auto (dates / Billetweb)" },
  { value: "AVAILABLE", label: "Disponible" },
  { value: "SOLD_OUT", label: "Complet" },
  { value: "COMING_SOON", label: "Bientôt disponible" },
];

function toInputDate(isoDate: string | null): string {
  if (!isoDate) return "";
  return isoDate.substring(0, 10);
}

const emptyTier = {
  nameFr: "",
  nameEn: "",
  price: "",
  isVisible: true,
  saleStartDate: "",
  saleEndDate: "",
  externalUrl: "",
  sortOrder: "0",
  manualStatus: "AUTO",
  isOutsideFlow: false,
};

function TierTable({
  title,
  tiers,
  onEdit,
  onDelete,
  collapsed,
}: {
  title: string;
  tiers: TicketTier[];
  onEdit: (tier: TicketTier) => void;
  onDelete: (tier: TicketTier) => void;
  collapsed?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!collapsed);

  if (tiers.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-bold text-noir mb-2 hover:text-malachite transition-colors"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>&#9654;</span>
        {title} ({tiers.length})
      </button>
      {isOpen && (
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
                  <td className="px-4 py-3 text-noir font-medium">
                    {tier.nameFr}
                    {tier.isOutsideFlow && (
                      <span className="ml-2" title="Accueil dédié : pas de numéro de badge, pas de passage aux guichets">
                        <StatusBadge status="Hors flux" variant="blue" />
                      </span>
                    )}
                    {!tier.billetwebTicketId && <span className="ml-2 text-xs text-gris" title="Créé à la main : les imports Billetweb n'y touchent pas">manuel</span>}
                  </td>
                  <td className="px-4 py-3 text-noir">{tier.price} EUR</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={TICKET_STATUS.find((s) => s.value === tier.status)?.label || tier.status} variant={TICKET_STATUS.find((s) => s.value === tier.status)?.variant || "gray"} />
                      {tier.manualStatus && <span className="text-xs text-gris" title="Statut forcé manuellement">forcé</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => onEdit(tier)} className="text-bleu hover:underline text-sm">Modifier</button>
                    <button onClick={() => onDelete(tier)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
  // Billetweb credits a sale to the site only through `src` (#507).
  const [trackingSource, setTrackingSource] = useState("site");
  // The edition's Billetweb event (#637): once linked, imports update the tiers.
  const [link, setLink] = useState<BilletwebLink>({ billetwebEventId: null, billetwebEventName: null });
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  async function loadTiers() {
    setIsLoading(true);
    const [tierRes, linkRes] = await Promise.all([
      adminFetch<TicketTier[]>(`/tickets?editionId=${editionId}`),
      adminFetch<BilletwebLink>(`/tickets/billetweb/link/${editionId}`),
    ]);
    if (tierRes.data) setTiers(tierRes.data);
    if (linkRes.data) setLink(linkRes.data);
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
      isVisible: tier.isVisible,
      saleStartDate: toInputDate(tier.saleStartDate),
      saleEndDate: toInputDate(tier.saleEndDate),
      externalUrl: tier.externalUrl || "",
      sortOrder: String(tier.sortOrder),
      manualStatus: tier.manualStatus || "AUTO",
      isOutsideFlow: tier.isOutsideFlow,
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
      isVisible: form.isVisible,
      saleStartDate: form.saleStartDate || null,
      saleEndDate: form.saleEndDate || null,
      externalUrl: form.externalUrl || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      manualStatus: form.manualStatus,
      isOutsideFlow: form.isOutsideFlow,
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

  async function handleUnlink() {
    setShowUnlinkConfirm(false);
    setUnlinkError(null);
    const { status } = await adminFetch(`/tickets/billetweb/link/${editionId}`, { method: "DELETE" });
    if (status === 200) {
      loadTiers();
    } else {
      setUnlinkError("L'événement Billetweb n'a pas pu être délié. Réessayez.");
    }
  }

  // Billetweb import
  async function openImportModal() {
    setShowImportModal(true);
    setImportError(null);
    setSelectedEvent(null);
    // A linked edition imports from its own event: no list to pick from.
    if (link.billetwebEventId) return;
    setIsLoadingEvents(true);

    const { data, status } = await adminFetch<BilletwebEvent[]>("/tickets/billetweb/events");
    if (status === 200 && data) {
      setBwEvents(data);
    } else {
      setImportError("Impossible de charger les événements Billetweb. Vérifiez la configuration API.");
      setBwEvents([]);
    }
    setIsLoadingEvents(false);
  }

  async function handleImport() {
    if (!link.billetwebEventId && !selectedEvent) return;
    setIsImporting(true);
    setImportError(null);

    const { data, status, error } = await adminFetch<{ imported: number }>("/tickets/import/billetweb", {
      method: "POST",
      body: JSON.stringify({
        editionId,
        ...(link.billetwebEventId ? {} : { billetwebEventId: selectedEvent?.id }),
        trackingSource,
      }),
    });

    setIsImporting(false);

    if (status === 201 && data) {
      setShowImportModal(false);
      setSelectedEvent(null);
      loadTiers();
    } else {
      setImportError(error || "Erreur lors de l'import des tarifs.");
    }
  }

  if (isLoading) return <p className="text-gris text-sm">Chargement…</p>;

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

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        {link.billetwebEventId ? (
          <>
            <span className="text-noir">
              Événement Billetweb lié : <strong>{link.billetwebEventName || link.billetwebEventId}</strong>
            </span>
            <button onClick={() => setShowUnlinkConfirm(true)} className="text-terre-cuite hover:underline">
              Délier
            </button>
          </>
        ) : (
          <span className="text-gris">
            Aucun événement Billetweb lié : le premier import lie celui que vous choisissez.
          </span>
        )}
        {unlinkError && <span className="text-terre-cuite">{unlinkError}</span>}
      </div>

      {showForm && (
        <div className="bg-blanc-casse/50 rounded-xl p-6 mb-6 space-y-4">
          <h4 className="text-sm font-bold text-noir">{editingId ? "Modifier le tarif" : "Nouveau tarif"}</h4>

          <BilingualInput label="Nom" nameFr="nameFr" nameEn="nameEn" valueFr={form.nameFr} valueEn={form.nameEn} onChangeFr={(v) => setForm({ ...form, nameFr: v })} onChangeEn={(v) => setForm({ ...form, nameEn: v })} required />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Prix (EUR)" name="price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
            <FormField label="Début des ventes" name="saleStartDate" type="date" value={form.saleStartDate} onChange={(v) => setForm({ ...form, saleStartDate: v })} />
            <FormField label="Fin des ventes" name="saleEndDate" type="date" value={form.saleEndDate} onChange={(v) => setForm({ ...form, saleEndDate: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Ordre" name="sortOrder" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
            <FormField label="URL externe" name="externalUrl" type="url" value={form.externalUrl} onChange={(v) => setForm({ ...form, externalUrl: v })} />
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Statut</label>
              <select
                value={form.manualStatus}
                onChange={(e) => setForm({ ...form, manualStatus: e.target.value })}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              >
                {MANUAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gris mt-1">
                « Auto » calcule le statut selon les dates de vente et l&apos;épuisement Billetweb.
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">Visible sur le site</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isOutsideFlow}
                onChange={(e) => setForm({ ...form, isOutsideFlow: e.target.checked })}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">Hors flux</span>
            </label>
            <p className="text-xs text-gris mt-1">
              Speakers, staff, bénévoles, prestataires : accueil dédié, sans numéro de badge ni passage aux guichets.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse">Annuler</button>
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {tiers.length === 0 ? (
        <p className="text-gris text-sm">Aucun tarif pour cette édition.</p>
      ) : (
        <>
          <TierTable
            title="Tarifs visibles sur le site"
            tiers={tiers.filter((t) => t.isVisible)}
            onEdit={startEdit}
            onDelete={setDeleteTarget}
          />
          <TierTable
            title="Tarifs masqués"
            tiers={tiers.filter((t) => !t.isVisible)}
            onEdit={startEdit}
            onDelete={setDeleteTarget}
            collapsed
          />
        </>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} title="Supprimer le tarif" message={`Supprimer "${deleteTarget?.nameFr}" ?`} confirmLabel="Supprimer" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog
        isOpen={showUnlinkConfirm}
        title="Délier l'événement Billetweb"
        message="Les tarifs restent en place. Le prochain import vous fera choisir un événement : le même retrouve ses tarifs, un autre envoie ceux-ci à la corbeille."
        confirmLabel="Délier"
        variant="danger"
        onConfirm={handleUnlink}
        onCancel={() => setShowUnlinkConfirm(false)}
      />

      {/* Billetweb import modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir/50">
          <div className="bg-blanc rounded-xl shadow-card w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gris/20">
              <h3 className="text-lg font-bold text-noir">Importer depuis Billetweb</h3>
              <p className="text-sm text-gris mt-1">
                {link.billetwebEventId
                  ? `Depuis l'événement lié : ${link.billetwebEventName || link.billetwebEventId}.`
                  : "Sélectionnez un événement : il sera lié à l'édition."}{" "}
                Les tarifs connus sont mis à jour et les nouveaux ajoutés ; ceux que Billetweb ne propose plus
                vont à la corbeille. Les tarifs créés à la main et la case « hors flux » sont conservés.
              </p>
            </div>

            {/* Linked edition: no event to pick, so the list area only shows up to carry an error. */}
            {(!link.billetwebEventId || importError) && (
            <div className="flex-1 overflow-y-auto px-6 py-4 border-b border-gris/20">
              {isLoadingEvents && <p className="text-gris text-sm">Chargement des événements...</p>}

              {importError && (
                <div className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
                  {importError}
                </div>
              )}

              {!link.billetwebEventId && !isLoadingEvents && bwEvents.length === 0 && !importError && (
                <p className="text-gris text-sm">Aucun événement trouvé.</p>
              )}

              {!link.billetwebEventId && bwEvents.map((event) => (
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
                    {event.date ? new Date(event.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Date non définie"}
                  </p>
                </button>
              ))}
            </div>
            )}

            <div className="px-6 py-4">
              <FormField
                label="Source de suivi"
                name="trackingSource"
                value={trackingSource}
                onChange={setTrackingSource}
                helpText="Ajoutée aux liens Billetweb (src=…) pour compter les ventes venues du site. Laisser vide pour ne pas suivre."
              />
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
                disabled={(!link.billetwebEventId && !selectedEvent) || isImporting}
                className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
              >
                {isImporting ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
