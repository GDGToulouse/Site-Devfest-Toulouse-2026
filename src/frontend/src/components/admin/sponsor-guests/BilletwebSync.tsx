"use client";

import { useEffect, useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// Sending the guests to Billetweb (#731, RG-INS-40 to RG-INS-48): where the
// tickets go, what a sync would do, and the sync itself. Each valid guest
// without a ticket gets one, mailed by Billetweb; from then on the guest is
// read-only on the site and corrects their ticket through its own link.

interface Settings {
  eventId: string | null;
  ticketId: string | null;
  ticketName: string | null;
  hasCredentials: boolean;
}

interface PreviewGuest {
  id: number;
  lastName: string;
  firstName: string;
  sponsorName: string;
  billetwebError: string | null;
}

interface Preview {
  toCreate: PreviewGuest[];
  blockedOutOfQuota: PreviewGuest[];
  ticketedOutOfQuota: PreviewGuest[];
  withErrors: PreviewGuest[];
}

interface SyncResult {
  created: number;
  adopted: number;
  refreshed: number;
  failed: number;
  blockedOutOfQuota: number;
  missingOptionalFields: string[];
}

const selectClass =
  "w-full rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function BilletwebSync({
  editionId,
  isAdmin,
  refreshKey,
  onSynced,
}: {
  editionId: number;
  isAdmin: boolean;
  // Bumped by the parent after a change to the guests, to refresh the preview.
  refreshKey: number;
  onSynced: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[] | null>(null);
  const [tickets, setTickets] = useState<{ id: string; name: string }[] | null>(null);
  const [eventId, setEventId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  async function loadSettings() {
    const { data } = await adminFetch<Settings>(`/editions/${editionId}/sponsor-guests/billetweb`);
    if (!data) return;
    setSettings(data);
    setEventId(data.eventId ?? "");
    setTicketId(data.ticketId ?? "");
  }

  async function loadPreview() {
    const { data } = await adminFetch<Preview>(`/editions/${editionId}/sponsor-guests/billetweb/preview`);
    setPreview(data);
  }

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, refreshKey]);

  async function startEditing() {
    setIsEditing(true);
    setFeedback(null);
    const { data } = await adminFetch<{ id: string | number; name: string }[]>("/tickets/billetweb/events");
    setEvents((data ?? []).map((e) => ({ id: String(e.id), name: e.name })));
    if (eventId) void loadTickets(eventId);
  }

  async function loadTickets(id: string) {
    setTickets(null);
    if (!id) return;
    const { data } = await adminFetch<{ id: string; name: string }[]>(
      `/editions/${editionId}/sponsor-guests/billetweb/tickets?eventId=${encodeURIComponent(id)}`,
    );
    setTickets(data ?? []);
    // The tariff the team has used for sponsors so far (RG-INS-47).
    if (data && !data.some((t) => t.id === ticketId)) {
      setTicketId(data.find((t) => /sponsor/i.test(t.name))?.id ?? "");
    }
  }

  async function saveSettings() {
    setIsBusy(true);
    const ticketName = tickets?.find((t) => t.id === ticketId)?.name ?? null;
    const res = await adminFetch(`/editions/${editionId}/sponsor-guests/billetweb`, {
      method: "PUT",
      body: JSON.stringify({ eventId: eventId || null, ticketId: ticketId || null, ticketName }),
    });
    setIsBusy(false);
    if (res.status === 200) {
      setIsEditing(false);
      setFeedback({ kind: "ok", text: "Tarif Billetweb enregistré." });
      void loadSettings();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "L'enregistrement a échoué. Réessayez.") });
  }

  async function sync() {
    setIsConfirming(false);
    setIsBusy(true);
    setResult(null);
    setFeedback(null);
    const res = await adminFetch<SyncResult>(`/editions/${editionId}/sponsor-guests/billetweb/sync`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setIsBusy(false);
    if (res.data) setResult(res.data);
    else setFeedback({ kind: "error", text: humanError(res, "La synchronisation a échoué. Réessayez.") });
    void loadPreview();
    onSynced();
  }

  if (!settings) return null;
  const isConfigured = Boolean(settings.eventId && settings.ticketId);
  const toCreate = preview?.toCreate.length ?? 0;

  return (
    <section className="space-y-4 rounded-xl bg-blanc-casse/50 p-6">
      <h3 className="text-lg font-bold text-noir">Billets Billetweb</h3>

      {!settings.hasCredentials && (
        <p role="alert" className="rounded-lg bg-terre-cuite/10 px-3 py-2 text-sm text-terre-cuite">
          Les identifiants Billetweb ne sont pas configurés sur ce serveur : la synchronisation est impossible.
        </p>
      )}

      {isEditing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Événement</span>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                void loadTickets(e.target.value);
              }}
              className={selectClass}
            >
              <option value="">{events ? "Choisir…" : "Chargement…"}</option>
              {events?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Tarif des invités sponsors</span>
            <select value={ticketId} onChange={(e) => setTicketId(e.target.value)} disabled={!tickets} className={selectClass}>
              <option value="">{eventId && !tickets ? "Chargement…" : "Choisir…"}</option>
              {tickets?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={isBusy}
              className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-gris hover:underline">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-noir">
          {isConfigured ? (
            <>
              Tarif : <strong>{settings.ticketName ?? settings.ticketId}</strong>{" "}
              <span className="text-gris">(événement {settings.eventId})</span>
            </>
          ) : (
            "Aucun tarif choisi : choisissez l'événement et le tarif dans lesquels créer les billets des invités."
          )}
          {isAdmin && (
            <button type="button" onClick={() => void startEditing()} className="ml-3 text-sm text-bleu hover:underline">
              {isConfigured ? "Changer" : "Choisir"}
            </button>
          )}
        </p>
      )}

      {preview && (
        <ul className="space-y-1 text-sm text-noir">
          <li>
            <strong>{toCreate}</strong> billet{toCreate > 1 ? "s" : ""} à créer
          </li>
          {preview.blockedOutOfQuota.length > 0 && (
            <li className="text-terre-cuite">
              {preview.blockedOutOfQuota.length} invité{preview.blockedOutOfQuota.length > 1 ? "s" : ""} hors quota, sans billet :{" "}
              {preview.blockedOutOfQuota.map((g) => `${g.firstName} ${g.lastName} (${g.sponsorName})`).join(", ")}
            </li>
          )}
          {preview.ticketedOutOfQuota.length > 0 && (
            <li className="text-terre-cuite">
              {preview.ticketedOutOfQuota.length} invité{preview.ticketedOutOfQuota.length > 1 ? "s ont" : " a"} un billet mais
              dépasse{preview.ticketedOutOfQuota.length > 1 ? "nt" : ""} le quota : annulez le billet ou remontez le quota.
            </li>
          )}
          {preview.withErrors.length > 0 && (
            <li className="text-terre-cuite">
              {preview.withErrors.length} en erreur au dernier passage : {preview.withErrors[0].billetwebError}
            </li>
          )}
        </ul>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={isBusy || !isConfigured || !settings.hasCredentials}
            className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            {isBusy ? "Synchronisation…" : "Synchroniser avec Billetweb"}
          </button>
          <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
        </div>
      )}

      {result && (
        <div role="status" className="rounded-lg bg-malachite/10 px-3 py-2 text-sm text-noir">
          {result.created} billet{result.created > 1 ? "s créés" : " créé"}
          {result.adopted > 0 && `, ${result.adopted} déjà présent${result.adopted > 1 ? "s" : ""} dans Billetweb et rattaché${result.adopted > 1 ? "s" : ""}`}
          {result.refreshed > 0 && `, ${result.refreshed} mis à jour depuis Billetweb`}.
          {result.failed > 0 && (
            <span className="block text-terre-cuite">
              {result.failed} échec{result.failed > 1 ? "s" : ""} : voir les invités en erreur ci-dessous, puis relancez.
            </span>
          )}
          {result.missingOptionalFields.length > 0 && (
            <span className="block text-gris">
              Question{result.missingOptionalFields.length > 1 ? "s" : ""} absente{result.missingOptionalFields.length > 1 ? "s" : ""} du
              formulaire Billetweb : {result.missingOptionalFields.join(", ")}. Ajoutez-les pour y retrouver le sponsor
              et l&apos;origine des billets.
            </span>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirming}
        title="Synchroniser avec Billetweb"
        message={`${toCreate} billet${toCreate > 1 ? "s" : ""} va être créé${toCreate > 1 ? "s" : ""} et envoyé${toCreate > 1 ? "s" : ""} par e-mail par Billetweb. Les invités concernés ne pourront plus être modifiés depuis le site.`}
        confirmLabel="Créer les billets"
        onConfirm={() => void sync()}
        onCancel={() => setIsConfirming(false)}
      />
    </section>
  );
}
