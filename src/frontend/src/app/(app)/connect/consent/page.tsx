"use client";

import { useEffect, useState } from "react";

import {
  answerConsent,
  getAgentClient,
  getCurrentUser,
  signedOAuthQuery,
  type SessionUser,
} from "@/lib/connect-api";
import ConnectShell from "@/components/connect/ConnectShell";

// The person decides (#514). What the agent gets is exactly what this account
// can do on the site — no more, since every call it makes goes through the same
// API checks, and no less. Saying so plainly is the whole point of the screen.

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "ready"; user: SessionUser; agentName: string; oauthQuery: string }
  | { kind: "answering" }
  | { kind: "failed" };

export default function ConsentPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    async function load() {
      const oauthQuery = signedOAuthQuery(window.location.search);
      const clientId = new URLSearchParams(window.location.search).get("client_id");
      const user = await getCurrentUser();
      if (!oauthQuery || !clientId || !user) {
        setState({ kind: "invalid" });
        return;
      }
      const client = await getAgentClient(clientId);
      // The name comes from the agent's own metadata document: shown as its
      // claim, never as something we vouch for.
      setState({ kind: "ready", user, agentName: client?.name || clientId, oauthQuery });
    }
    load();
  }, []);

  async function answer(accept: boolean) {
    if (state.kind !== "ready") return;
    const { oauthQuery } = state;
    setState({ kind: "answering" });
    const result = await answerConsent(accept, oauthQuery);
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setState({ kind: "failed" });
  }

  if (state.kind === "loading" || state.kind === "answering") {
    return (
      <ConnectShell>
        <p role="status" aria-live="polite" className="text-center text-gris">
          {state.kind === "answering" ? "Retour vers l'agent…" : "Chargement…"}
        </p>
      </ConnectShell>
    );
  }

  if (state.kind === "invalid" || state.kind === "failed") {
    return (
      <ConnectShell>
        <p role="alert" className="text-center text-noir">
          {state.kind === "failed"
            ? "La réponse n'a pas pu être enregistrée : la demande a peut-être expiré."
            : "Cette demande d'autorisation n'est pas valable ou a expiré."}
        </p>
        <p className="mt-3 text-center text-sm text-gris">Relancez la connexion depuis votre agent.</p>
      </ConnectShell>
    );
  }

  return (
    <ConnectShell>
      <p className="text-noir">
        <strong>{state.agentName}</strong> demande à agir sur le site du DevFest Toulouse avec votre compte{" "}
        <strong>{state.user.name || state.user.email}</strong>.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gris">
        <li>Il pourra consulter et modifier tout ce que votre compte peut consulter et modifier — rien de plus.</li>
        <li>Chacune de ses modifications sera enregistrée à votre nom dans l&apos;historique du site.</li>
        <li>Vous pourrez lui retirer cet accès à tout moment depuis votre compte.</li>
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => answer(true)}
          className="w-full rounded-[12px] bg-malachite px-4 py-3 font-bold text-blanc transition-colors hover:bg-malachite/90"
        >
          Autoriser
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          className="w-full rounded-[12px] border border-gris/30 px-4 py-3 font-medium text-noir transition-colors hover:bg-blanc-casse"
        >
          Refuser
        </button>
      </div>
    </ConnectShell>
  );
}
