"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";

interface Contact {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  hasLink: boolean;
  editLinkLocked: boolean;
  editTokenSentAt: string | null;
}

// Admin management of a sponsor's modification-link contacts (#250): a sponsor
// can have several people, each with their own link, lock and resend. Replaces
// the single-link EditLinkActions for sponsors.
export default function SponsorContacts({ sponsorId }: { sponsorId: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data } = await adminFetch<Contact[]>(`/sponsors/${sponsorId}/contacts`);
    if (data) setContacts(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  async function add() {
    if (!email.trim()) {
      setMsg({ ok: false, text: "Renseignez une adresse email." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { status } = await adminFetch(`/sponsors/${sponsorId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), name: name.trim(), role: role.trim() }),
    });
    setBusy(false);
    if (status === 201) {
      setMsg({ ok: true, text: `Lien envoyé à ${email.trim()}.` });
      setEmail("");
      setName("");
      setRole("");
      void load();
    } else {
      setMsg({ ok: false, text: "Échec de l'envoi. Réessayez." });
    }
  }

  async function resend(id: number) {
    setBusy(true);
    setMsg(null);
    const { status } = await adminFetch(`/sponsors/${sponsorId}/contacts/${id}/resend`, { method: "POST" });
    setBusy(false);
    setMsg(status === 200 ? { ok: true, text: "Nouveau lien envoyé." } : { ok: false, text: "Échec." });
    if (status === 200) void load();
  }

  async function toggleLock(contact: Contact) {
    setBusy(true);
    setMsg(null);
    const next = !contact.editLinkLocked;
    const { status } = await adminFetch(`/sponsors/${sponsorId}/contacts/${contact.id}/lock`, {
      method: "PUT",
      body: JSON.stringify({ locked: next }),
    });
    setBusy(false);
    if (status === 200) void load();
    else setMsg({ ok: false, text: "Échec." });
  }

  async function remove(id: number) {
    setBusy(true);
    setMsg(null);
    const { status } = await adminFetch(`/sponsors/${sponsorId}/contacts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (status === 204) void load();
    else setMsg({ ok: false, text: "Échec de la suppression." });
  }

  return (
    <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4 space-y-4">
      <p className="text-sm font-medium text-noir">Contacts &amp; liens de modification</p>

      {loading ? (
        <p className="text-sm text-gris">Chargement…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gris">Aucun contact pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gris/15 bg-blanc px-3 py-2">
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium text-noir">
                  {c.name || c.email}
                  {c.role && <span className="ml-2 text-xs text-gris">({c.role})</span>}
                </p>
                {c.name && <p className="text-xs text-gris">{c.email}</p>}
              </div>
              {c.editLinkLocked && (
                <span className="rounded-full bg-terre-cuite/10 px-2 py-0.5 text-xs font-medium text-terre-cuite">
                  Verrouillé
                </span>
              )}
              <button type="button" onClick={() => resend(c.id)} disabled={busy} className="text-xs font-medium text-malachite hover:underline disabled:opacity-50">
                Renvoyer le lien
              </button>
              <button type="button" onClick={() => toggleLock(c)} disabled={busy} className="text-xs font-medium text-noir hover:underline disabled:opacity-50">
                {c.editLinkLocked ? "Déverrouiller" : "Verrouiller"}
              </button>
              <button type="button" onClick={() => remove(c.id)} disabled={busy} className="text-xs font-medium text-terre-cuite hover:underline disabled:opacity-50">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gris/15 pt-3">
        <p className="mb-2 text-xs font-semibold text-gris">Ajouter un contact</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs text-gris">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className={inputClass} />
          </label>
          <label className="min-w-[120px]">
            <span className="mb-1 block text-xs text-gris">Nom (optionnel)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="min-w-[120px]">
            <span className="mb-1 block text-xs text-gris">Rôle (optionnel)</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
          </label>
          <button type="button" onClick={add} disabled={busy} className="px-3 py-2 text-sm rounded-lg bg-malachite text-blanc font-medium hover:bg-malachite/90 disabled:opacity-50">
            Ajouter &amp; envoyer
          </button>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-malachite" : "text-terre-cuite"}`}>{msg.text}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
