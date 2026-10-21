"use client";

import { useEffect, useState } from "react";

import { signInWithEmail, signInWithSocial } from "@/lib/admin-api";
import { requestMagicLink } from "@/lib/sponsor-api";
import { continueAuthorization, getCurrentUser, signedOAuthQuery } from "@/lib/connect-api";
import ConnectShell from "@/components/connect/ConnectShell";
import SponsorFeedback from "@/components/sponsor-space/SponsorFeedback";

// Where an AI agent sends a person to sign in before it may act for them
// (#514). Neutral on purpose: the team and the sponsors both come here, with
// the same means of signing in as their own screens. No sign-up — the
// invitation stays the only way to get an account.
//
// Every method ends the same way: once this browser holds a session, the page
// hands the provider back its signed request and follows where it points (the
// consent screen). A magic link or Google/GitHub open the session elsewhere and
// return here, so resuming from a session is the one path, not a special case.

interface Providers {
  google: boolean;
  github: boolean;
}

type Phase = "checking" | "form" | "resuming" | "invalid" | "expired";

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function ConnectPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [oauthQuery, setOauthQuery] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);

  async function resume(query: string) {
    setPhase("resuming");
    const result = await continueAuthorization(query);
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    // The signed request lives about ten minutes: an expired or tampered one is
    // refused, and only the agent can start a fresh one.
    setPhase("expired");
  }

  useEffect(() => {
    const query = signedOAuthQuery(window.location.search);
    if (!query) {
      setPhase("invalid");
      return;
    }
    setOauthQuery(query);
    getCurrentUser().then((user) => (user ? resume(query) : setPhase("form")));
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProviders(data))
      .catch(() => {});
  }, []);

  const returnPath = () => `/connect${window.location.search}`;

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oauthQuery) return;
    setIsLoading(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    if (result.success) {
      await resume(oauthQuery);
      return;
    }
    setError(result.error || "Erreur de connexion");
    setIsLoading(false);
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Renseignez votre adresse email.");
      return;
    }
    setIsLoading(true);
    setError(null);
    await requestMagicLink(email.trim(), `${window.location.origin}${returnPath()}`);
    // Same message whether or not an account exists: telling them apart would
    // turn this button into a way to find out who has one.
    setLinkSent(true);
    setIsLoading(false);
  }

  async function handleSocial(provider: "google" | "github") {
    setIsLoading(true);
    setError(null);
    const result = await signInWithSocial(provider, returnPath());
    if (!result.ok) {
      setError(result.error || "Connexion impossible");
      setIsLoading(false);
    }
  }

  if (phase === "checking" || phase === "resuming") {
    return (
      <ConnectShell>
        <p role="status" aria-live="polite" className="text-center text-gris">
          {phase === "resuming" ? "Connexion de l'agent…" : "Chargement…"}
        </p>
      </ConnectShell>
    );
  }

  if (phase === "invalid" || phase === "expired") {
    return (
      <ConnectShell>
        <p role="alert" className="text-center text-noir">
          {phase === "expired"
            ? "Cette demande de connexion a expiré ou n'est plus valable."
            : "Cette page s'ouvre depuis un agent IA qui demande l'accès à votre compte."}
        </p>
        <p className="mt-3 text-center text-sm text-gris">
          Relancez la connexion depuis votre agent (par exemple Claude) : il ouvrira une nouvelle demande.
        </p>
      </ConnectShell>
    );
  }

  if (linkSent) {
    return (
      <ConnectShell>
        <p role="status" aria-live="polite" className="text-center text-noir">
          Si un compte existe pour <strong>{email.trim()}</strong>, un lien de connexion vient d&apos;y être
          envoyé. Ouvrez-le dans ce navigateur, dans les 10 minutes : la demande de l&apos;agent expire ensuite.
        </p>
        <button
          type="button"
          onClick={() => setLinkSent(false)}
          className="mt-6 w-full text-sm font-medium text-gris hover:text-noir"
        >
          Utiliser une autre méthode
        </button>
      </ConnectShell>
    );
  }

  return (
    <ConnectShell>
      <p className="mb-6 text-sm text-gris">
        Un agent IA demande à accéder au site du DevFest Toulouse en votre nom. Connectez-vous avec votre compte
        habituel : vous verrez ensuite ce que vous l&apos;autorisez à faire.
      </p>

      {(providers?.google || providers?.github) && (
        <div className="space-y-3">
          {providers.google && (
            <button
              type="button"
              onClick={() => handleSocial("google")}
              disabled={isLoading}
              className="w-full rounded-[12px] border border-gris/30 px-4 py-3 font-medium text-noir transition-colors hover:bg-blanc-casse disabled:opacity-50"
            >
              Continuer avec Google
            </button>
          )}
          {providers.github && (
            <button
              type="button"
              onClick={() => handleSocial("github")}
              disabled={isLoading}
              className="w-full rounded-[12px] border border-gris/30 px-4 py-3 font-medium text-noir transition-colors hover:bg-blanc-casse disabled:opacity-50"
            >
              Continuer avec GitHub
            </button>
          )}
          <div className="flex items-center gap-3 py-2">
            <span className="h-px flex-1 bg-gris/20" />
            <span className="text-xs text-gris">ou</span>
            <span className="h-px flex-1 bg-gris/20" />
          </div>
        </div>
      )}

      <form onSubmit={handlePassword} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        <SponsorFeedback message={error ? { isOk: false, text: error } : null} />

        <button
          type="submit"
          disabled={isLoading || !email.trim() || !password}
          className="w-full rounded-[12px] bg-malachite px-4 py-3 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
        >
          {isLoading ? "Connexion…" : "Me connecter"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={isLoading}
        className="mt-4 w-full text-sm font-medium text-bleu hover:underline disabled:opacity-50"
      >
        Recevoir un lien de connexion par email
      </button>

      <p className="mt-6 text-center text-xs text-gris">
        Accès réservé aux comptes existants : équipe DevFest et partenaires invités.
      </p>
    </ConnectShell>
  );
}
