"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { adminFetch, getAdminSession, humanError } from "@/lib/admin-api";
import {
  DIET_OPTIONS,
  draftOf,
  EMPTY_GUEST,
  EXPERIENCE_OPTIONS,
  guestDraftError,
  labelOf,
  type Guest,
  type GuestDraft,
  type ImportFailure,
  type ImportPreview,
} from "@/lib/sponsor-guests";
import GuestFields from "@/components/sponsor-guests/GuestFields";
import GuestCsvImport from "@/components/sponsor-guests/GuestCsvImport";
import ListPagination from "@/components/admin/ListPagination";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import RegistrationSettings from "./RegistrationSettings";
import BilletwebSync from "./BilletwebSync";
import SponsorQuotaPanel from "./SponsorQuotaPanel";
import AttachTicket from "./AttachTicket";

// The sponsors' guests of an edition (#727, #730, #731, #732): opening and
// deadline, Billetweb, each sponsor's places, and every guest with the alerts.
// The team is not bound by the sponsors' rules: it adds after the deadline and
// past the quota — a guest past it is out of quota and gets no ticket.

interface SponsorSummary {
  participationId: number;
  sponsor: { id: number; name: string };
  basePlaces: number;
  adjustmentTotal: number;
  quota: number;
  registeredCount: number;
  outOfQuotaCount: number;
}

interface AdminGuest extends Guest {
  sponsor: { id: number; name: string };
  billetwebTicketId: string | null;
  billetwebTicketRef: string | null;
  billetwebError: string | null;
  isBilletwebCancelled: boolean;
}

interface GuestList {
  sponsors: SponsorSummary[];
  alerts: { outOfQuota: number; outOfQuotaWithTicket: number; duplicates: number; errors: number };
  page: number;
  limit: number;
  total: number;
  items: AdminGuest[];
}

const FILTERS = [
  { value: "", label: "Tous les invités" },
  { value: "outOfQuota", label: "Hors quota" },
  { value: "duplicates", label: "Adresse en double" },
  { value: "withoutTicket", label: "Sans billet" },
  { value: "withTicket", label: "Avec billet" },
  { value: "errors", label: "En erreur ou annulés" },
];

const PAGE_SIZE = 50;

type PanelKey = "places" | "add" | "import" | "attach";

export default function SponsorGuestsTab({ editionId }: { editionId: number }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [list, setList] = useState<GuestList | null>(null);
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [managedSponsorId, setManagedSponsorId] = useState<number | null>(null);
  const [panel, setPanel] = useState<PanelKey>("places");
  const [draft, setDraft] = useState<GuestDraft>(EMPTY_GUEST);
  const [editing, setEditing] = useState<AdminGuest | null>(null);
  const [toCancel, setToCancel] = useState<AdminGuest | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);
  // Each keystroke in the search starts a request: only the latest one may
  // fill the list, or a slower earlier answer overwrites it.
  const latestLoad = useRef(0);

  useEffect(() => {
    getAdminSession().then((session) => setIsAdmin(session?.role === "ADMIN"));
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (sponsorFilter) params.set("sponsorId", sponsorFilter);
    if (filter) params.set("filter", filter);
    if (search.trim()) params.set("search", search.trim());
    const ticket = ++latestLoad.current;
    const { data } = await adminFetch<GuestList>(`/editions/${editionId}/sponsor-guests?${params}`);
    if (data && ticket === latestLoad.current) setList(data);
  }, [editionId, page, sponsorFilter, filter, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function manage(sponsorId: number, key: PanelKey = "places") {
    setManagedSponsorId(sponsorId);
    setPanel(key);
    setEditing(null);
    setDraft(EMPTY_GUEST);
    setFeedback(null);
  }

  function startEdit(guest: AdminGuest) {
    manage(guest.sponsor.id, "add");
    setEditing(guest);
    setDraft(draftOf(guest));
  }

  async function saveGuest() {
    const problem = guestDraftError(draft);
    if (problem || managedSponsorId === null) {
      setFeedback({ kind: "error", text: problem ?? "Choisissez un sponsor." });
      return;
    }
    setIsBusy(true);
    const res = editing
      ? await adminFetch(`/sponsor-guests/${editing.id}`, { method: "PUT", body: JSON.stringify(draft) })
      : await adminFetch(`/sponsors/${managedSponsorId}/editions/${editionId}/guests`, { method: "POST", body: JSON.stringify(draft) });
    setIsBusy(false);
    if (res.status === 200 || res.status === 201) {
      setFeedback({ kind: "ok", text: editing ? "Invité mis à jour." : `${draft.firstName.trim()} ${draft.lastName.trim()} est inscrit·e.` });
      setEditing(null);
      setDraft(EMPTY_GUEST);
      refresh();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "L'enregistrement a échoué. Réessayez.") });
  }

  async function remove(guest: AdminGuest) {
    if (!window.confirm(`Retirer ${guest.firstName} ${guest.lastName} (${guest.sponsor.name}) ? Sa place sera libérée.`)) return;
    const res = await adminFetch(`/sponsor-guests/${guest.id}`, { method: "DELETE" });
    if (res.status === 204) refresh();
    else setFeedback({ kind: "error", text: humanError(res, "Le retrait a échoué. Réessayez.") });
  }

  async function cancelTicket() {
    const guest = toCancel;
    setToCancel(null);
    if (!guest) return;
    const res = await adminFetch(`/sponsor-guests/${guest.id}/cancel-ticket`, { method: "POST" });
    if (res.status === 204) {
      setFeedback({ kind: "ok", text: `Billet de ${guest.firstName} ${guest.lastName} annulé dans Billetweb.` });
      refresh();
      return;
    }
    setFeedback({ kind: "error", text: humanError(res, "L'annulation a échoué. Réessayez.") });
  }

  async function runImport(file: string, confirm: boolean) {
    const res = await adminFetch<ImportPreview>(`/sponsors/${managedSponsorId}/editions/${editionId}/guests/import`, {
      method: "POST",
      body: JSON.stringify({ file, confirm }),
    });
    return res.data || res.status === 201
      ? { status: res.status, preview: res.data ?? undefined }
      : { status: res.status, failure: (res.errorBody ?? {}) as ImportFailure };
  }

  const managed = list?.sponsors.find((s) => s.sponsor.id === managedSponsorId) ?? null;

  return (
    <div className="space-y-6">
      <RegistrationSettings editionId={editionId} isAdmin={isAdmin} onSaved={refresh} />
      <BilletwebSync editionId={editionId} isAdmin={isAdmin} refreshKey={refreshKey} onSynced={refresh} />

      {list && (list.alerts.outOfQuota > 0 || list.alerts.duplicates > 0 || list.alerts.errors > 0) && (
        <ul role="alert" className="space-y-1 rounded-lg border border-terre-cuite/30 bg-terre-cuite/5 p-3 text-sm text-terre-cuite">
          {list.alerts.outOfQuota > 0 && (
            <li>
              {list.alerts.outOfQuota} invité{list.alerts.outOfQuota > 1 ? "s" : ""} hors quota, sans billet
              {list.alerts.outOfQuotaWithTicket > 0 && ` (dont ${list.alerts.outOfQuotaWithTicket} avec un billet déjà envoyé)`}.
            </li>
          )}
          {list.alerts.duplicates > 0 && (
            <li>{list.alerts.duplicates} invités partagent une adresse avec un collègue : un seul recevra les consignes.</li>
          )}
          {list.alerts.errors > 0 && <li>{list.alerts.errors} invité{list.alerts.errors > 1 ? "s" : ""} en erreur Billetweb ou au billet annulé.</li>}
        </ul>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-noir">Places par sponsor</h3>
        {!list ? (
          <p className="text-sm text-gris">Chargement…</p>
        ) : list.sponsors.length === 0 ? (
          <p className="text-sm text-gris">Aucun sponsor pour cette édition.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gris/20 bg-blanc-casse/60 text-left">
                  <th className="px-4 py-2 font-medium text-gris">Sponsor</th>
                  <th className="px-4 py-2 font-medium text-gris">Places</th>
                  <th className="px-4 py-2 font-medium text-gris">Inscrits</th>
                  <th className="px-4 py-2 font-medium text-gris">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.sponsors.map((s) => (
                  <tr key={s.sponsor.id} className={`border-b border-gris/10 ${managedSponsorId === s.sponsor.id ? "bg-malachite/5" : ""}`}>
                    <td className="px-4 py-2 font-medium text-noir">{s.sponsor.name}</td>
                    <td className="px-4 py-2 text-noir">
                      {s.quota}
                      {s.adjustmentTotal !== 0 && (
                        <span className="text-xs text-gris">
                          {" "}
                          ({s.basePlaces} {s.adjustmentTotal > 0 ? "+" : "−"} {Math.abs(s.adjustmentTotal)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-noir">
                      {s.registeredCount}
                      {s.outOfQuotaCount > 0 && <span className="text-terre-cuite"> · {s.outOfQuotaCount} hors quota</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => manage(s.sponsor.id)} className="text-sm text-bleu hover:underline">
                        Gérer<span className="sr-only"> {s.sponsor.name}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {managed && (
        <section aria-label={`Invités de ${managed.sponsor.name}`} className="space-y-4 rounded-xl border border-malachite/30 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold text-noir">{managed.sponsor.name}</h3>
            <button type="button" onClick={() => setManagedSponsorId(null)} className="ml-auto text-sm text-gris hover:underline">
              Fermer
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist">
            {(
              [
                { key: "places", label: "Places" },
                { key: "add", label: editing ? "Modifier l'invité" : "Inscrire" },
                { key: "import", label: "Importer un CSV" },
                ...(isAdmin ? [{ key: "attach", label: "Rattacher un billet" }] : []),
              ] as { key: PanelKey; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={panel === t.key}
                onClick={() => setPanel(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm ${panel === t.key ? "bg-malachite text-blanc" : "border border-gris/30 text-noir hover:bg-blanc-casse"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {panel === "places" && <SponsorQuotaPanel sponsorId={managed.sponsor.id} editionId={editionId} onChanged={refresh} />}
          {panel === "add" && (
            <div className="space-y-4">
              <GuestFields draft={draft} onChange={setDraft} idPrefix="admin-guest" />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveGuest()}
                  disabled={isBusy}
                  className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
                >
                  {editing ? "Enregistrer" : "Inscrire"}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setDraft(EMPTY_GUEST);
                    }}
                    className="text-sm text-gris hover:underline"
                  >
                    Annuler
                  </button>
                )}
              </div>
              {!editing && managed.registeredCount >= managed.quota && (
                <p className="text-xs text-terre-cuite">Toutes les places sont prises : cet invité sera hors quota, sans billet.</p>
              )}
            </div>
          )}
          {panel === "import" && (
            <GuestCsvImport
              templateUrl="/api/admin/sponsor-guests/template"
              runImport={runImport}
              isTeam
              onImported={(count) => {
                setFeedback({ kind: "ok", text: `${count} invité${count > 1 ? "s importés" : " importé"}.` });
                refresh();
              }}
            />
          )}
          {panel === "attach" && isAdmin && <AttachTicket sponsorId={managed.sponsor.id} editionId={editionId} onAttached={refresh} />}
        </section>
      )}

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-noir">Invités</h3>
        <div className="flex flex-wrap gap-3">
          <select
            value={sponsorFilter}
            onChange={(e) => {
              setSponsorFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par sponsor"
            className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir"
          >
            <option value="">Tous les sponsors</option>
            {list?.sponsors.map((s) => (
              <option key={s.sponsor.id} value={s.sponsor.id}>
                {s.sponsor.name}
              </option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer les invités"
            className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Nom, e-mail, sponsor…"
            aria-label="Rechercher un invité"
            className="min-w-[200px] flex-1 rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir"
          />
        </div>

        {list && list.items.length === 0 ? (
          <p className="text-sm text-gris">Aucun invité ne correspond.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gris/20 bg-blanc-casse/60 text-left">
                  <th className="px-4 py-2 font-medium text-gris">Invité</th>
                  <th className="px-4 py-2 font-medium text-gris">Sponsor</th>
                  <th className="px-4 py-2 font-medium text-gris">État</th>
                  <th className="px-4 py-2 font-medium text-gris">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list?.items.map((g) => (
                  <tr key={g.id} className="border-b border-gris/10 align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium text-noir">
                        {g.firstName} {g.lastName}
                      </p>
                      <p className="break-all text-xs text-gris">{g.email}</p>
                      <p className="text-xs text-gris">
                        {labelOf(EXPERIENCE_OPTIONS, g.experience)}
                        {g.attendsAfterParty && " · after"}
                        {g.diet !== "NONE" && ` · ${labelOf(DIET_OPTIONS, g.diet)}`}
                        {g.needsAssistance && " · assistance"}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-noir">
                      {g.sponsor.name}
                      <span className="block text-xs text-gris">n° {g.rank}</span>
                    </td>
                    <td className="space-y-0.5 px-4 py-2 text-xs">
                      {!g.isWithinQuota && <p className="font-medium text-terre-cuite">Hors quota</p>}
                      {g.hasDuplicateEmail && <p className="text-terre-cuite">Adresse en double</p>}
                      {g.billetwebTicketId ? (
                        <p className={g.isBilletwebCancelled ? "text-terre-cuite" : "text-malachite"}>
                          {g.isBilletwebCancelled ? "Billet annulé dans Billetweb" : `Billet ${g.billetwebTicketRef ?? g.billetwebTicketId}`}
                        </p>
                      ) : (
                        <p className="text-gris">Sans billet</p>
                      )}
                      {g.billetwebError && <p className="text-terre-cuite">{g.billetwebError}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {g.billetwebTicketId ? (
                        isAdmin && (
                          <button type="button" onClick={() => setToCancel(g)} className="text-xs text-terre-cuite hover:underline">
                            Annuler le billet<span className="sr-only"> de {g.firstName} {g.lastName}</span>
                          </button>
                        )
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(g)} className="mr-3 text-xs text-noir hover:underline">
                            Modifier<span className="sr-only"> {g.firstName} {g.lastName}</span>
                          </button>
                          <button type="button" onClick={() => void remove(g)} className="text-xs text-terre-cuite hover:underline">
                            Retirer<span className="sr-only"> {g.firstName} {g.lastName}</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list && list.total > PAGE_SIZE && (
          <ListPagination page={list.page} limit={list.limit} total={list.total} onPageChange={setPage} />
        )}
      </section>

      <ConfirmDialog
        isOpen={toCancel !== null}
        title="Annuler le billet"
        message={
          toCancel
            ? `Le billet de ${toCancel.firstName} ${toCancel.lastName} (${toCancel.sponsor.name}) sera supprimé dans Billetweb, et l'invité retiré de la liste. Sa place sera libérée.`
            : ""
        }
        confirmLabel="Annuler le billet"
        variant="danger"
        onConfirm={() => void cancelTicket()}
        onCancel={() => setToCancel(null)}
      />
    </div>
  );
}
