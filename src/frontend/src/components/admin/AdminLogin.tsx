"use client";

import { useState } from "react";
import { getAuthUrl, signInWithEmail, signUpWithEmail, forgotPassword } from "@/lib/admin-api";

type Mode = "login" | "signup" | "forgot";

export default function AdminLogin() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "login") {
      const result = await signInWithEmail(email, password);
      if (result.success) {
        window.location.reload();
      } else {
        setError(result.error || "Erreur de connexion");
      }
    } else if (mode === "signup") {
      const result = await signUpWithEmail(name, email, password);
      if (result.success) {
        setSuccess("Compte créé ! Vérifiez votre email pour activer votre compte.");
        setMode("login");
      } else {
        setError(result.error || "Erreur lors de l'inscription");
      }
    } else {
      const result = await forgotPassword(email);
      if (result.success) {
        setSuccess("Un email de réinitialisation a été envoyé.");
      } else {
        setError(result.error || "Erreur lors de l'envoi");
      }
    }

    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blanc-casse">
      <div className="bg-blanc rounded-3xl shadow-card p-10 max-w-md w-full">
        <h1 className="text-3xl font-bold text-noir mb-2 text-center">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Admin</span>
        </h1>
        <p className="text-gris mb-6 text-center">
          {mode === "login" && "Connectez-vous pour accéder au back-office."}
          {mode === "signup" && "Créez votre compte administrateur."}
          {mode === "forgot" && "Entrez votre email pour réinitialiser votre mot de passe."}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rouge/10 text-bismarck text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-[12px] bg-malachite/10 text-[#0A6B4B] text-sm">{success}</div>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-noir mb-1">Nom</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-[12px] border-2 border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu focus:border-bleu"
                placeholder="Votre nom"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-noir mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-[12px] border-2 border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu focus:border-bleu"
              placeholder="vous@example.com"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-noir mb-1">
                Mot de passe
                {mode === "signup" && <span className="text-gris font-normal"> (min. 10 caractères)</span>}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 10 : undefined}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu focus:border-bleu"
                placeholder={mode === "signup" ? "10 caractères minimum" : "Votre mot de passe"}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors disabled:opacity-50"
          >
            {isLoading
              ? "Chargement..."
              : mode === "login"
                ? "Se connecter"
                : mode === "signup"
                  ? "Créer mon compte"
                  : "Envoyer le lien"}
          </button>
        </form>

        {/* Mode switchers */}
        <div className="mt-4 text-center text-sm space-y-2">
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }} className="text-bleu hover:underline block mx-auto">
                Mot de passe oublié ?
              </button>
              <button onClick={() => { setMode("signup"); setError(null); setSuccess(null); }} className="text-bleu hover:underline block mx-auto">
                Créer un compte
              </button>
            </>
          )}
          {(mode === "signup" || mode === "forgot") && (
            <button onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className="text-bleu hover:underline block mx-auto">
              Retour à la connexion
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="mt-6 flex items-center gap-4">
          <hr className="flex-1 border-gris-clair" />
          <span className="text-sm text-gris">ou</span>
          <hr className="flex-1 border-gris-clair" />
        </div>

        {/* Social login */}
        <div className="mt-6 space-y-3">
          <a
            href={getAuthUrl("google")}
            className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-[12px] border-2 border-gris-clair text-noir font-bold hover:bg-blanc-casse transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </a>
          <a
            href={getAuthUrl("github")}
            className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-[12px] bg-noir text-blanc font-bold hover:bg-noir/90 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
