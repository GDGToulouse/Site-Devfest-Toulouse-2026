"use client";

import { useEffect, useState } from "react";

import GuestFields from "@/components/sponsor-guests/GuestFields";
import GuestCsvImport from "@/components/sponsor-guests/GuestCsvImport";
import SponsorFeedback, { type SponsorMessage } from "@/components/sponsor-space/SponsorFeedback";
import {
  createSponsorGuest,
  deleteSponsorGuest,
  getSponsorGuests,
  importSponsorGuests,
  inviteTeamMember,
  sponsorGuestTemplateUrl,
  updateSponsorGuest,
  type SponsorAccessRole,
  type SponsorGuest,
  type SponsorGuests,
} from "@/lib/sponsor-api";
import {
  DIET_OPTIONS,
  draftOf,
  EMPTY_GUEST,
  EXPERIENCE_OPTIONS,
  formatDeadline,
  guestDraftError,
  labelOf,
  timeLeft,
  type GuestDraft,
} from "@/lib/sponsor-guests";
import { SPONSOR_ROLE_OPTIONS } from "@/lib/sponsor-roles";

// The people the company sends to the DevFest (#728), within the places of its
// pack and until the deadline (docs/specs/inscriptions-sponsors.md). The API
// refuses what this screen hides: hiding is convenience, not protection.

export default function GuestsTab({ sponsorId, canManageTeam }: { sponsorId: number; canManageTeam: boolean }) {
  const [state, setState] = useState<SponsorGuests | null>(null);
  const [isUnreachable, setIsUnreachable] = useState(false);
  const [draft, setDraft] = useState<GuestDraft>(EMPTY_GUEST);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<SponsorMessage | null>(null);
  const [now, setNow] = useState(() => new Date());

  async function load() {
    const { data, status } = await getSponsorGuests(sponsorId);
    if (data) setState(data);
    setIsUnreachable(!data && (status === 0 || status >= 500));
  }

  useEffect(() => {
    void load();
    // The countdown moves on its own; a minute is its finest unit.
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  if (isUnreachable) {
    return <p className="text-sm text-terre-cuite">La liste n&apos;a pas pu être chargée. Rechargez la page.</p>;
  }
  if (!state?.guests) return <p className="text-sm text-gris">Chargement…</p>;

  const { registration, guests } = state;
  const quota = state.quota ?? 0;
  const remaining = state.remaining ?? 0;
  const canWrite = registration.canWrite;
  const left = registration.deadline ? timeLeft(registration.deadline, now) : null;

  function startEdit(guest: SponsorGuest) {
    setEditingId(guest.id);
    setDraft(draftOf(guest));
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_GUEST);
    setMessage(null);
  }

  async function submit() {
    const problem = guestDraftError(draft);
    if (problem) {
      setMessage({ isOk: false, text: problem });
      return;
    }
    setIsBusy(true);
    setMessage(null);
    const result =
      editingId === null ? await createSponsorGuest(sponsorId, draft) : await updateSponsorGuest(sponsorId, editingId, draft);
    setIsBusy(false);
    if (result.status === 201 || result.status === 200) {
      const wasNew = editingId === null;
      setEditingId(null);
      setDraft(EMPTY_GUEST);
      setMessage({ isOk: true, text: wasNew ? `${draft.firstName.trim()} ${draft.lastName.trim()} est inscrit·e.` : "Inscription mise à jour." });
      void load();
      return;
    }
    setMessage({ isOk: false, text: result.message ?? writeError(result.error) });
    if (result.status === 409) void load();
  }

  async function remove(guest: SponsorGuest) {
    if (!window.confirm(`Retirer ${guest.firstName} ${guest.lastName} ? Sa place sera libérée.`)) return;
    setIsBusy(true);
    setMessage(null);
    const { status, error, message: detail } = await deleteSponsorGuest(sponsorId, guest.id);
    setIsBusy(false);
    if (status === 204) {
      setMessage({ isOk: true, text: `${guest.firstName} ${guest.lastName} a été retiré·e.` });
      if (editingId === guest.id) cancelEdit();
      void load();
      return;
    }
    setMessage({ isOk: false, text: detail ?? writeError(error) });
  }

  return (
    <div className="space-y-6">
      <section aria-label="Places et échéance" className="space-y-1">
        <p className="text-sm text-noir">
          <span className="font-bold">{guests.length}</span> inscrit{guests.length > 1 ? "s" : ""} sur{" "}
          <span className="font-bold">{quota}</span> place{quota > 1 ? "s" : ""}
          {canWrite && (
            <>
              {" "}· {remaining} restante{remaining > 1 ? "s" : ""}
            </>
          )}
        </p>
        <p className="text-sm text-gris">
          {!registration.isOpen || registration.isPastDeadline
            ? "Les inscriptions sont closes. Pour toute modification, contactez l'équipe du DevFest."
            : registration.deadline && left
              ? `Inscriptions ouvertes jusqu'au ${formatDeadline(registration.deadline)} (encore ${left}).`
              : "Inscriptions ouvertes."}
        </p>
      </section>

      {canWrite ? (
        <p className="rounded-lg bg-blanc-casse/60 p-3 text-xs text-gris">
          Vous inscrivez d&apos;autres personnes : prévenez-les. Leurs informations servent à leur envoyer leur billet,
          à les accueillir, à prévoir les repas et à établir des statistiques anonymes de l&apos;édition. Le détail
          d&apos;un besoin d&apos;assistance ou d&apos;un régime « Autre » se précise par e-mail, jamais ici.
        </p>
      ) : (
        registration.isOpen &&
        !registration.isPastDeadline && (
          <p className="text-xs text-gris">Les responsables et éditeurs de votre espace inscrivent les personnes.</p>
        )
      )}

      {(state.outOfQuotaCount ?? 0) > 0 && (
        <p role="alert" className="rounded-lg border border-terre-cuite/30 bg-terre-cuite/5 p-3 text-sm text-terre-cuite">
          {state.outOfQuotaCount} inscrit{(state.outOfQuotaCount ?? 0) > 1 ? "s dépassent" : " dépasse"} vos places : sans
          place, pas de billet. Contactez l&apos;équipe du DevFest si vous avez besoin de places supplémentaires.
        </p>
      )}

      <SponsorFeedback message={message} />

      {guests.length === 0 ? (
        <p className="text-sm text-gris">Personne n&apos;est encore inscrit.</p>
      ) : (
        <ul className="space-y-2">
          {guests.map((g) => (
            <GuestRow
              key={g.id}
              guest={g}
              sponsorId={sponsorId}
              canEdit={canWrite && !g.hasTicket}
              canGiveAccess={canManageTeam}
              isBusy={isBusy}
              onEdit={() => startEdit(g)}
              onRemove={() => void remove(g)}
            />
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="space-y-4 rounded-lg border border-gris/20 bg-blanc-casse/50 p-4">
          <h3 className="text-sm font-medium text-noir">{editingId === null ? "Inscrire une personne" : "Modifier l'inscription"}</h3>
          {editingId === null && remaining === 0 ? (
            <p className="text-sm text-gris">
              Toutes vos places sont prises. Retirez une inscription, ou demandez des places supplémentaires à
              l&apos;équipe du DevFest.
            </p>
          ) : (
            <>
              <GuestFields draft={draft} onChange={setDraft} idPrefix="sponsor-guest" />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={isBusy}
                  className="rounded-[12px] bg-malachite px-5 py-2.5 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
                >
                  {editingId === null ? "Inscrire" : "Enregistrer"}
                </button>
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isBusy}
                    className="rounded-[12px] border border-gris/30 px-5 py-2.5 font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {canWrite && editingId === null && remaining > 0 && (
        <div className="space-y-3 rounded-lg border border-gris/20 bg-blanc-casse/50 p-4">
          <h3 className="text-sm font-medium text-noir">Inscrire plusieurs personnes depuis un fichier</h3>
          <GuestCsvImport
            templateUrl={sponsorGuestTemplateUrl(sponsorId)}
            runImport={(file, confirm) => importSponsorGuests(sponsorId, file, confirm)}
            onImported={(count) => {
              setMessage({ isOk: true, text: `${count} personne${count > 1 ? "s inscrites" : " inscrite"}.` });
              void load();
            }}
          />
        </div>
      )}
    </div>
  );
}

function GuestRow({
  guest: g,
  sponsorId,
  canEdit,
  canGiveAccess,
  isBusy,
  onEdit,
  onRemove,
}: {
  guest: SponsorGuest;
  sponsorId: number;
  canEdit: boolean;
  canGiveAccess: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [isGivingAccess, setIsGivingAccess] = useState(false);
  const [accessRole, setAccessRole] = useState<SponsorAccessRole>("STAND");
  const [accessMessage, setAccessMessage] = useState<SponsorMessage | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Registering someone gives no access (RG-INS-23): this sends the usual team
  // invitation, prefilled from the guest.
  async function giveAccess() {
    setIsSending(true);
    const { status, error } = await inviteTeamMember(sponsorId, {
      email: g.email,
      name: `${g.firstName} ${g.lastName}`,
      accessRole,
    });
    setIsSending(false);
    if (status === 201) {
      setIsGivingAccess(false);
      setAccessMessage({ isOk: true, text: `Invitation envoyée à ${g.email}.` });
      return;
    }
    setAccessMessage({
      isOk: false,
      text:
        error === "already_on_team"
          ? "Cette personne a déjà accès à votre espace."
          : status === 429
            ? "Trop d'invitations envoyées : réessayez dans quelques minutes."
            : "L'invitation n'a pas pu être envoyée. Réessayez.",
    });
  }

  return (
    <li className="rounded-lg border border-gris/15 bg-blanc px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-medium text-noir">
            {g.firstName} {g.lastName}
            {!g.isWithinQuota && <Badge tone="alert">Hors quota</Badge>}
            {g.hasTicket && !g.isTicketCancelled && <Badge tone="ok">Billet envoyé</Badge>}
            {g.isTicketCancelled && <Badge tone="alert">Billet annulé</Badge>}
          </p>
          <p className="break-all text-xs text-gris">
            {g.email}
            {g.hasDuplicateEmail && <span className="ml-2 text-terre-cuite">adresse utilisée deux fois</span>}
          </p>
          <p className="text-xs text-gris">
            {labelOf(EXPERIENCE_OPTIONS, g.experience)}
            {g.attendsAfterParty && " · after"}
            {g.diet !== "NONE" && ` · ${labelOf(DIET_OPTIONS, g.diet)}`}
            {g.needsAssistance && " · assistance"}
          </p>
        </div>
        {canEdit && (
          <>
            <button type="button" onClick={onEdit} disabled={isBusy} className={`${rowActionClass} text-noir focus:ring-noir/30`}>
              Modifier<span className="sr-only"> l&apos;inscription de {g.firstName} {g.lastName}</span>
            </button>
            <button type="button" onClick={onRemove} disabled={isBusy} className={`${rowActionClass} text-terre-cuite focus:ring-terre-cuite/50`}>
              Retirer<span className="sr-only"> {g.firstName} {g.lastName}</span>
            </button>
          </>
        )}
        {canGiveAccess && !isGivingAccess && (
          <button
            type="button"
            onClick={() => {
              setIsGivingAccess(true);
              setAccessMessage(null);
            }}
            className={`${rowActionClass} text-bleu focus:ring-bleu/40`}
          >
            Donner accès à l&apos;espace<span className="sr-only"> à {g.firstName} {g.lastName}</span>
          </button>
        )}
      </div>

      {g.hasTicket && (
        <p className="mt-1 text-xs text-gris">
          Billet envoyé : pour corriger une information, la personne utilise le lien en bas de l&apos;e-mail de son
          billet Billetweb.
        </p>
      )}

      {isGivingAccess && (
        <div className="mt-2 flex flex-wrap items-end gap-3 border-t border-gris/10 pt-2">
          <label className="block">
            <span className="mb-1 block text-xs text-gris">Rôle dans l&apos;espace</span>
            <select
              value={accessRole}
              onChange={(e) => setAccessRole(e.target.value as SponsorAccessRole)}
              className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir"
            >
              {SPONSOR_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void giveAccess()}
            disabled={isSending}
            className="rounded-[12px] bg-malachite px-4 py-2 text-sm font-bold text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            Envoyer l&apos;invitation
          </button>
          <button type="button" onClick={() => setIsGivingAccess(false)} className="text-sm text-gris hover:underline">
            Annuler
          </button>
        </div>
      )}
      <SponsorFeedback message={accessMessage} />
    </li>
  );
}

function Badge({ tone, children }: { tone: "ok" | "alert"; children: React.ReactNode }) {
  return (
    <span
      className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
        tone === "ok" ? "bg-malachite/10 text-malachite" : "bg-terre-cuite/10 text-terre-cuite"
      }`}
    >
      {children}
    </span>
  );
}

function writeError(error: string | undefined) {
  if (error === "registration_closed") return "Les inscriptions sont closes.";
  if (error === "guest_has_ticket") return "Le billet de cette personne est déjà envoyé : elle se corrige depuis son billet.";
  if (error === "invalid_field") return "Une information est invalide. Vérifiez l'adresse e-mail.";
  return "L'enregistrement a échoué. Réessayez.";
}

const rowActionClass =
  "inline-flex min-h-[24px] items-center rounded px-2 py-1 text-xs font-medium hover:underline disabled:opacity-50 focus:outline-none focus:ring-2";
