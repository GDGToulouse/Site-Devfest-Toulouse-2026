"use client";

import { useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface EditLinkActionsProps {
  // "speakers" | "sponsors" — the admin route segment.
  resource: "speakers" | "sponsors";
  entityId: number;
  // Current contact email (prefilled) and lock state, from the entity.
  initialEmail: string;
  initialLocked: boolean;
}

// Admin controls for the modification link of a speaker/sponsor (US-221):
// send (email), revoke, lock/unlock.
export default function EditLinkActions({
  resource,
  entityId,
  initialEmail,
  initialLocked,
}: EditLinkActionsProps) {
  const [email, setEmail] = useState(initialEmail);
  const [locked, setLocked] = useState(initialLocked);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  async function send() {
    if (!email.trim()) {
      setMsg({ ok: false, text: "Renseignez une adresse email." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { status } = await adminFetch(`/${resource}/${entityId}/edit-link`, {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    setMsg(
      status === 200
        ? { ok: true, text: `Lien envoyé à ${email.trim()}.` }
        : { ok: false, text: "Échec de l'envoi. Réessayez." },
    );
  }

  async function revoke() {
    setBusy(true);
    setMsg(null);
    const { status } = await adminFetch(`/${resource}/${entityId}/edit-link`, { method: "DELETE" });
    setBusy(false);
    setIsRevoking(false);
    setMsg(status === 200 ? { ok: true, text: "Lien révoqué." } : { ok: false, text: "Échec." });
  }

  async function toggleLock() {
    setBusy(true);
    setMsg(null);
    const next = !locked;
    const { status } = await adminFetch(`/${resource}/${entityId}/edit-link/lock`, {
      method: "PUT",
      body: JSON.stringify({ locked: next }),
    });
    setBusy(false);
    if (status === 200) {
      setLocked(next);
      setMsg({ ok: true, text: next ? "Fiche verrouillée." : "Fiche déverrouillée." });
    } else {
      setMsg({ ok: false, text: "Échec." });
    }
  }

  return (
    <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4 space-y-3">
      <p className="text-sm font-medium text-noir">Lien de modification</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemple.com"
          className="flex-1 min-w-[200px] rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-lg bg-malachite text-blanc font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          Envoyer le lien
        </button>
        <button
          type="button"
          onClick={() => setIsRevoking(true)}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc disabled:opacity-50"
        >
          Révoquer
        </button>
        <button
          type="button"
          onClick={toggleLock}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc disabled:opacity-50"
        >
          {locked ? "Déverrouiller" : "Verrouiller"}
        </button>
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

      {/* The link is already in someone's mailbox: revoking it strands them with
          no warning on either side (#414). */}
      <ConfirmDialog
        isOpen={isRevoking}
        title="Révoquer le lien"
        message="Le lien déjà envoyé cessera de fonctionner immédiatement. Son destinataire ne pourra plus modifier sa fiche tant qu'un nouveau lien ne lui aura pas été envoyé."
        confirmLabel="Révoquer"
        variant="danger"
        onConfirm={revoke}
        onCancel={() => setIsRevoking(false)}
      />
    </div>
  );
}
