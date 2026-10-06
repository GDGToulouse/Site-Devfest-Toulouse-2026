"use client";

import { useEffect, useState } from "react";

import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { listMyAgents, revokeMyAgent, type ConnectedAgent } from "@/lib/connect-api";

// The AI agents acting for the signed-in person (#514), on their own account
// page — the team's profile and a sponsor's "Mon compte" alike. No frame of its
// own: each page sets it in its own card.

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ConnectedAgents() {
  const [agents, setAgents] = useState<ConnectedAgent[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pending, setPending] = useState<ConnectedAgent | null>(null);
  const [error, setError] = useState("");
  // Known only in the browser; the page itself is client-rendered.
  const [connectorUrl, setConnectorUrl] = useState("");

  async function load() {
    setAgents(await listMyAgents());
    setIsLoaded(true);
  }

  useEffect(() => {
    setConnectorUrl(`${window.location.origin}/api/mcp`);
    load();
  }, []);

  async function confirmRevoke() {
    if (!pending) return;
    const agent = pending;
    setPending(null);
    setError("");
    const status = await revokeMyAgent(agent.clientId);
    // 404: already gone (revoked from another tab) — the list catches up.
    if (status !== 204 && status !== 404) {
      setError(
        status === 0
          ? "Le serveur n'a pas pu être joint : l'accès n'a pas été retiré. Réessayez."
          : "L'accès n'a pas pu être retiré. Réessayez, ou prévenez l'équipe si cela persiste.",
      );
      return;
    }
    await load();
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-bold text-noir">Agents IA connectés</h2>
      <p className="mb-4 text-sm text-gris">
        Un agent IA (Claude, par exemple) peut agir sur le site avec les droits de votre compte, une fois que vous
        l&apos;avez autorisé. Pour en connecter un, ajoutez ce connecteur dans l&apos;agent :{" "}
        <code className="break-all rounded bg-blanc-casse px-1 py-0.5 text-xs text-noir">{connectorUrl}</code>
      </p>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 rounded-lg bg-terre-cuite/10 p-3 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {!isLoaded ? (
        <p className="text-sm text-gris">Chargement…</p>
      ) : agents === null ? (
        <p role="alert" className="text-sm text-terre-cuite">
          La liste des agents n&apos;a pas pu être chargée. Rechargez la page pour réessayer.
        </p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-gris">Aucun agent n&apos;a accès à votre compte.</p>
      ) : (
        <ul className="divide-y divide-gris/10">
          {agents.map((agent) => (
            <li key={agent.clientId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-noir">{agent.name || "Agent sans nom"}</p>
                <p className="text-xs text-gris">
                  Autorisé le {formatDate(agent.connectedAt)}
                  {agent.lastTokenAt && ` · dernière connexion le ${formatDate(agent.lastTokenAt)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPending(agent)}
                className="text-sm font-medium text-terre-cuite hover:underline"
              >
                Retirer l&apos;accès
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={pending !== null}
        title="Retirer l'accès de cet agent ?"
        message={`${pending?.name || "Cet agent"} ne pourra plus agir sur le site avec votre compte. Pour le reconnecter, il faudra l'autoriser à nouveau.`}
        confirmLabel="Retirer l'accès"
        variant="danger"
        onConfirm={confirmRevoke}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
