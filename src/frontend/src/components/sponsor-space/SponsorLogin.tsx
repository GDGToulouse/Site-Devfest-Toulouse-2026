"use client";

import { useEffect, useState } from "react";

import { signInWithSocial, signInWithEmail } from "@/lib/admin-api";
import { requestMagicLink, signUpWithEmail } from "@/lib/sponsor-api";
import SponsorFeedback from "@/components/sponsor-space/SponsorFeedback";

// Sign-in for a sponsor (#362). Deliberately not the admin screen: a sponsor
// account holds no back-office role, and landing on a page titled "DevFest
// Admin" would suggest otherwise. Same providers underneath.

interface Providers {
  google: boolean;
  github: boolean;
}

// mode="signup" is what someone arriving from an invitation sees. They have no
// account yet, and a screen headed "Sign in" reads as a dead end (#362) — the
// form is the same either way, only the wording changes.
export default function SponsorLogin({
  callbackURL,
  mode = "signin",
}: {
  callbackURL: string;
  mode?: "signin" | "signup";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProviders(data))
      .catch(() => {});
  }, []);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    // sign-in only authenticates an existing account; someone arriving from an
    // invitation has none yet and needs sign-up (#362).
    const result =
      mode === "signup"
        ? await signUpWithEmail(email.trim(), password, email.trim())
        : await signInWithEmail(email, password);
    if (result.success) {
      window.location.href = callbackURL;
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
    await requestMagicLink(email.trim(), callbackURL);
    // Same message whether or not an account exists: telling them apart would
    // turn this button into a way to find out who has one.
    setLinkSent(true);
    setIsLoading(false);
  }

  async function handleSocial(provider: "google" | "github") {
    setIsLoading(true);
    setError(null);
    const result = await signInWithSocial(provider, callbackURL);
    if (!result.ok) {
      setError(result.error || "Connexion impossible");
      setIsLoading(false);
    }
    // On success the browser navigates away to the provider.
  }

  if (linkSent) {
    return (
      <Shell mode={mode}>
        {/* This replaces the form rather than sitting beside it, so nothing
            about the swap is announced on its own (#427). */}
        <p role="status" aria-live="polite" className="text-center text-noir">
          Si un compte existe pour <strong>{email.trim()}</strong>, un lien de connexion vient d&apos;y
          être envoyé. Il est valable 60 minutes et ne peut servir qu&apos;une fois.
        </p>
        <button
          type="button"
          onClick={() => setLinkSent(false)}
          className="mt-6 w-full text-sm font-medium text-gris hover:text-noir"
        >
          Utiliser une autre méthode
        </button>
      </Shell>
    );
  }

  return (
    <Shell mode={mode}>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-noir">Mot de passe</span>
          <input
            type="password"
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
          {isLoading ? "Connexion…" : mode === "signup" ? "Créer mon compte" : "Me connecter"}
        </button>
      </form>

      {/* Sign-in only: the magic link runs with disableSignUp, so on this screen
          — where no account exists yet — it silently sends nothing and lands the
          visitor back here (#408). */}
      {mode === "signin" && (
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={isLoading}
          className="mt-4 w-full text-sm font-medium text-bleu hover:underline disabled:opacity-50"
        >
          Recevoir un lien de connexion par email
        </button>
      )}

      <p className="mt-6 text-center text-xs text-gris">
        {mode === "signup"
          ? "Choisissez un mot de passe, ou connectez-vous avec Google ou GitHub : votre compte sera créé avec l'adresse qui a reçu l'invitation."
          : "Accès sur invitation uniquement. Contactez l'équipe DevFest si vous n'avez pas encore reçu la vôtre."}
      </p>
    </Shell>
  );
}

function Shell({ children, mode }: { children: React.ReactNode; mode: "signin" | "signup" }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-2 text-center text-2xl font-bold text-noir">
          {mode === "signup" ? "Créer votre compte partenaire" : "Espace partenaire"}
        </h1>
        <p className="mb-6 text-center text-sm text-gris">DevFest Toulouse</p>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
