"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (error === "INVALID_TOKEN") {
      setErrorMsg("Ce lien n'est plus valide ou a expiré.");
    }
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (password.length < 10) {
      setErrorMsg("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!token) {
      setErrorMsg("Token manquant.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (res.ok) {
        setMessage("Mot de passe réinitialisé. Redirection...");
        setTimeout(() => router.push("/admin"), 1500);
      } else {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.message || "Erreur lors de la réinitialisation.");
      }
    } catch {
      setErrorMsg("Impossible de contacter le serveur.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blanc-casse">
      <div className="bg-blanc rounded-3xl shadow-card p-10 max-w-md w-full">
        <h1 className="text-3xl font-bold text-noir mb-2 text-center">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Admin</span>
        </h1>
        <p className="text-gris mb-6 text-center">
          Choisissez un nouveau mot de passe.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[12px] bg-rouge/10 text-bismarck text-sm">{errorMsg}</div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-[12px] bg-malachite/10 text-[#0A6B4B] text-sm">{message}</div>
        )}

        {token && !message && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-noir mb-1">
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu focus:border-bleu"
                placeholder="Au moins 10 caractères"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-noir mb-1">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu focus:border-bleu"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Envoi..." : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}

        {!token && !errorMsg && (
          <p className="text-gris text-sm text-center">
            Aucun token fourni. Veuillez utiliser le lien reçu par email.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
