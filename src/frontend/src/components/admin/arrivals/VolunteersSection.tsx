"use client";

import { useState, useEffect } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface VolunteerAccess {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  status: "granted" | "pending" | "expired";
  invitationSentAt: string | null;
  acceptedAt: string | null;
}

interface InviteReport {
  invited: string[];
  granted: string[];
  alreadyListed: string[];
  failed: string[];
  invalid: string[];
  duplicates: string[];
}

const STATUS_BADGES: Record<VolunteerAccess["status"], { label: string; variant: "green" | "blue" | "gray" }> = {
  granted: { label: "Accès ouvert", variant: "green" },
  pending: { label: "Invitation envoyée", variant: "blue" },
  expired: { label: "Invitation expirée", variant: "gray" },
};

// What the report lists, in the order an admin acts on it: failures first.
const REPORT_LINES: Array<{ key: keyof InviteReport; label: string; isProblem: boolean }> = [
  { key: "failed", label: "E-mails non partis, à réessayer", isProblem: true },
  { key: "invalid", label: "Adresses invalides, à corriger", isProblem: true },
  { key: "duplicates", label: "En double dans la liste", isProblem: false },
  { key: "alreadyListed", label: "Déjà invitées ou déjà autorisées", isProblem: false },
  { key: "granted", label: "Comptes existants, accès ouvert sans invitation", isProblem: false },
  { key: "invited", label: "Invitations envoyées", isProblem: false },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });
}

// The volunteers of the edition (RG-ARR-22, RG-ARR-23, #640): a pasted list of
// addresses becomes invitations, or open access for existing accounts, and the
// admin follows who accepted.
export default function VolunteersSection({ editionId }: { editionId: number }) {
  const [accesses, setAccesses] = useState<VolunteerAccess[] | null>(null);
  const [pasted, setPasted] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [report, setReport] = useState<InviteReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<VolunteerAccess | null>(null);

  async function load() {
    const { data } = await adminFetch<VolunteerAccess[]>(`/arrivals-access/${editionId}`);
    if (data) setAccesses(data);
  }

  useEffect(() => {
    load();
  }, [editionId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    setReport(null);
    const result = await adminFetch<InviteReport>(`/arrivals-access/${editionId}/invite`, {
      method: "POST",
      body: JSON.stringify({ emails: pasted }),
    });
    setIsSending(false);
    if (result.status === 201 && result.data) {
      setReport(result.data);
      // Keep only what still needs a hand: a typo to fix, a mail to retry.
      setPasted([...result.data.invalid, ...result.data.failed].join("\n"));
      load();
    } else {
      setError(humanError(result, "Les invitations ne sont pas parties. Réessayez."));
    }
  }

  async function handleResend(access: VolunteerAccess) {
    setError(null);
    const result = await adminFetch(`/arrivals-access/${editionId}/${access.id}/resend`, { method: "POST" });
    if (result.status === 200) load();
    else setError(humanError(result, `L'invitation de ${access.email} n'est pas repartie. Réessayez.`));
  }

  async function handleRemove() {
    if (!toRemove) return;
    const access = toRemove;
    setToRemove(null);
    setError(null);
    const result = await adminFetch(`/arrivals-access/${editionId}/${access.id}`, { method: "DELETE" });
    if (result.status === 204) load();
    else setError(humanError(result, `L'accès de ${access.email} n'a pas été retiré. Réessayez.`));
  }

  const granted = accesses?.filter((a) => a.status === "granted").length ?? 0;

  return (
    <section className="mt-8 pt-6 border-t border-gris/20">
      <h3 className="text-lg font-bold text-noir mb-2">Bénévoles</h3>
      <p className="text-sm text-gris mb-4">
        Les bénévoles reçoivent un compte qui n&apos;ouvre que l&apos;accueil du jour J, sur /arrivees, pour cette
        édition seulement. Collez leurs adresses, une par ligne ou séparées par des virgules : un compte existant
        reçoit l&apos;accès sans invitation.
      </p>

      <form onSubmit={handleInvite} className="mb-4">
        <label htmlFor="volunteer-emails" className="block text-sm text-gris mb-1">
          Adresses e-mail
        </label>
        <textarea
          id="volunteer-emails"
          rows={5}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"lea.martin@example.org\nJean Dupont <jean.dupont@example.org>"}
          className="w-full px-3 py-2 rounded-lg border border-gris/30 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={isSending || !pasted.trim()}
          className="mt-2 px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
        >
          {isSending ? "Envoi en cours…" : "Inviter"}
        </button>
      </form>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {error}
        </div>
      )}

      {report && (
        <div role="status" className="p-3 rounded-lg bg-blanc-casse text-sm mb-4 space-y-1">
          {REPORT_LINES.filter((line) => report[line.key].length > 0).map((line) => (
            <p key={line.key} className={line.isProblem ? "text-terre-cuite" : "text-noir"}>
              {line.label} : <strong>{report[line.key].length}</strong>
              {line.isProblem && ` (${report[line.key].join(", ")})`}
            </p>
          ))}
        </div>
      )}

      {accesses && accesses.length > 0 && (
        <>
          <p className="text-sm text-noir mb-2">
            Accès ouvert : {granted} sur {accesses.length}.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gris/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blanc-casse/60 border-b border-gris/20">
                  <th className="text-left px-4 py-3 font-medium text-gris">Adresse</th>
                  <th className="text-left px-4 py-3 font-medium text-gris">État</th>
                  <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map((access) => (
                  <tr key={access.id} className="border-b border-gris/10">
                    <td className="px-4 py-3 text-noir">
                      {access.email}
                      {access.name && access.name !== access.email && (
                        <span className="block text-xs text-gris">{access.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={STATUS_BADGES[access.status].label}
                        variant={STATUS_BADGES[access.status].variant}
                      />
                      <span className="block text-xs text-gris mt-1">
                        {access.acceptedAt
                          ? `Acceptée le ${formatDate(access.acceptedAt)}`
                          : access.invitationSentAt
                            ? `Envoyée le ${formatDate(access.invitationSentAt)}`
                            : "Compte existant"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {access.status !== "granted" && (
                        <button
                          onClick={() => handleResend(access)}
                          className="text-sm text-bleu hover:underline mr-4"
                        >
                          Renvoyer
                        </button>
                      )}
                      <button
                        onClick={() => setToRemove(access)}
                        className="text-sm text-terre-cuite hover:underline"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={toRemove !== null}
        title="Retirer l'accès ?"
        message={`${toRemove?.email ?? ""} ne pourra plus ouvrir l'accueil de cette édition. Son compte est conservé.`}
        confirmLabel="Retirer"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
    </section>
  );
}
