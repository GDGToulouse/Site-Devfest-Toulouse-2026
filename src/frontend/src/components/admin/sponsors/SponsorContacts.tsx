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
      {loading ? (
        <p className="text-sm text-gris-sur-creme">Chargement…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gris-sur-creme">Aucun contact pour l&apos;instant.</p>
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
              {/* 24×24 minimum on every row action (WCAG 2.2, #393), and each
                  one names its contact: three identical "Retirer" in a list
                  say nothing on their own to a screen reader. */}
              <button type="button" onClick={() => resend(c.id)} disabled={busy} className={`${rowActionClass} text-malachite focus:ring-malachite/50`}>
                Renvoyer le lien<span className="sr-only"> à {c.email}</span>
              </button>
              <button type="button" onClick={() => toggleLock(c)} disabled={busy} className={`${rowActionClass} text-noir focus:ring-noir/30`}>
                {c.editLinkLocked ? "Déverrouiller" : "Verrouiller"}<span className="sr-only"> le lien de {c.email}</span>
              </button>
              <button type="button" onClick={() => remove(c.id)} disabled={busy} className={`${rowActionClass} text-terre-cuite focus:ring-terre-cuite/50`}>
                Retirer<span className="sr-only"> le contact {c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gris/15 pt-3">
        <p className="mb-2 text-xs font-semibold text-gris-sur-creme">Ajouter un contact</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs text-gris-sur-creme">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className={inputClass} />
          </label>
          <label className="min-w-[120px]">
            <span className="mb-1 block text-xs text-gris-sur-creme">Nom (optionnel)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="min-w-[120px]">
            <span className="mb-1 block text-xs text-gris-sur-creme">Rôle (optionnel)</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
          </label>
          <button type="button" onClick={add} disabled={busy} className="px-3 py-2 text-sm rounded-lg bg-malachite text-blanc font-medium hover:bg-malachite/90 disabled:opacity-50">
            Ajouter &amp; envoyer
          </button>
        </div>
      </div>

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          aria-live={msg.ok ? "polite" : "assertive"}
          className={`text-sm ${msg.ok ? "text-malachite" : "text-terre-cuite"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

const rowActionClass =
  "inline-flex min-h-[24px] items-center rounded px-2 py-1 text-xs font-medium hover:underline disabled:opacity-50 focus:outline-none focus:ring-2";
