"use client";

import { useEffect, useState } from "react";

import {
  getSponsorTeam,
  inviteTeamMember,
  setTeamMemberRole,
  revokeTeamMember,
  type SponsorAccessRole,
  type SponsorTeamMember,
} from "@/lib/sponsor-api";

// Who may act on this space, and as what (#362). RESPONSABLE only — inviting is
// the whole difference between that role and EDITEUR.

const ROLE_OPTIONS: { value: SponsorAccessRole; label: string; hint: string }[] = [
  { value: "RESPONSABLE", label: "Responsable", hint: "Gère la fiche et invite l'équipe" },
  { value: "EDITEUR", label: "Éditeur", hint: "Gère la fiche" },
  { value: "STAND", label: "Stand", hint: "Consulte la fiche publique" },
];

export default function TeamTab({ sponsorId }: { sponsorId: number }) {
  const [members, setMembers] = useState<SponsorTeamMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accessRole, setAccessRole] = useState<SponsorAccessRole>("EDITEUR");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ isOk: boolean; text: string } | null>(null);

  async function load() {
    const { data } = await getSponsorTeam(sponsorId);
    setMembers(data ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  async function invite() {
    if (!email.trim()) {
      setMessage({ isOk: false, text: "Renseignez une adresse email." });
      return;
    }
    setIsBusy(true);
    setMessage(null);
    const { status, error } = await inviteTeamMember(sponsorId, {
      email: email.trim(),
      name: name.trim() || undefined,
      accessRole,
    });
    setIsBusy(false);

    if (status === 201) {
      setMessage({ isOk: true, text: `Invitation envoyée à ${email.trim()}.` });
      setEmail("");
      setName("");
      void load();
      return;
    }
    setMessage({
      isOk: false,
      text:
        error === "already_on_team"
          ? "Cette adresse fait déjà partie de l'équipe."
          : error === "email_failed"
            ? "L'email n'a pas pu être envoyé. Réessayez."
            : "L'invitation a échoué.",
    });
  }

  async function changeRole(member: SponsorTeamMember, next: SponsorAccessRole) {
    setIsBusy(true);
    setMessage(null);
    const { status, error } = await setTeamMemberRole(sponsorId, member.id, next);
    setIsBusy(false);
    if (status === 200) {
      void load();
      return;
    }
    setMessage({
      isOk: false,
      text:
        error === "last_responsable"
          ? "Il doit rester au moins un responsable : nommez quelqu'un d'autre avant de changer ce rôle."
          : "Le changement de rôle a échoué.",
    });
  }

  async function revoke(member: SponsorTeamMember) {
    if (!window.confirm(`Retirer l'accès de ${member.name || member.email} ?`)) return;
    setIsBusy(true);
    setMessage(null);
    const { status, error } = await revokeTeamMember(sponsorId, member.id);
    setIsBusy(false);
    if (status === 204) {
      setMessage({ isOk: true, text: "Accès retiré." });
      void load();
      return;
    }
    setMessage({
      isOk: false,
      text:
        error === "last_responsable"
          ? "Il doit rester au moins un responsable : nommez quelqu'un d'autre avant de retirer cet accès."
          : "Le retrait a échoué.",
    });
  }

  if (!members) return <p className="text-sm text-gris">Chargement…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gris">
        Invitez les personnes de votre équipe et choisissez ce que chacune peut faire.
      </p>

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-gris/15 bg-blanc px-3 py-2"
          >
            <div className="min-w-[180px] flex-1">
              <p className="text-sm font-medium text-noir">{m.name || m.email}</p>
              {m.name && <p className="text-xs text-gris">{m.email}</p>}
              {!m.hasAccount && (
                <p className="text-xs text-orange">
                  {m.invitationSentAt ? "Invitation envoyée, en attente" : "Pas encore invité"}
                </p>
              )}
            </div>

            <label className="sr-only" htmlFor={`role-${m.id}`}>
              Rôle de {m.name || m.email}
            </label>
            <select
              id={`role-${m.id}`}
              value={m.accessRole}
              onChange={(e) => changeRole(m, e.target.value as SponsorAccessRole)}
              disabled={isBusy}
              className="rounded-lg border border-gris/30 bg-blanc px-2 py-1.5 text-sm text-noir"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => revoke(m)}
              disabled={isBusy}
              className="text-xs font-medium text-terre-cuite hover:underline disabled:opacity-50"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4">
        <p className="mb-3 text-sm font-medium text-noir">Inviter quelqu&apos;un</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs text-gris">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom@societe.fr"
              className={inputClass}
            />
          </label>
          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs text-gris">Nom (optionnel)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="min-w-[150px]">
            <span className="mb-1 block text-xs text-gris">Rôle</span>
            <select
              value={accessRole}
              onChange={(e) => setAccessRole(e.target.value as SponsorAccessRole)}
              className={inputClass}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={invite}
            disabled={isBusy}
            className="rounded-lg bg-malachite px-3 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            Inviter
          </button>
        </div>
        <p className="mt-3 text-xs text-gris">
          {ROLE_OPTIONS.find((o) => o.value === accessRole)?.hint}
          {" · "}
          L&apos;invitation est valable 7 jours et doit être acceptée avec cette adresse exacte.
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.isOk ? "text-malachite" : "text-terre-cuite"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
